import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Compasso — MVP schema (v0.1)
 *
 * Hierarchy: Workspace (tenant) -> Organization (own company or client) -> Project -> Task
 * Tags are workspace-wide. Roles are per workspace (admin | member).
 *
 * Conventions
 * - All instants are `timestamptz` (stored in UTC). Never store local times.
 * - Duration is NOT stored: it is always derived from (ended_at - started_at),
 *   avoiding the corrupted-duration problem seen in the Clockify export.
 * - Every operational table carries `workspace_id`; every query must be
 *   filtered by it (see the tenant helper planned in step 3 of the plan).
 * - Out of MVP scope (added later via migrations): rates/cost, budgets,
 *   approvals, period locks, audit log.
 */

export const workspaceRole = pgEnum("workspace_role", ["admin", "member"]);

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------- identity

export const users = pgTable("users", {
  id: id(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  /** IANA zone, e.g. "America/Recife". Drives UI/calendar rendering. */
  timezone: text("timezone").notNull().default("America/Recife"),
  /**
   * Logical deletion (LGPD): set when the Clerk user is deleted. The row is kept
   * and anonymized (email/name/avatar cleared, clerk_id replaced) so historical
   * time entries stay intact and attributable to "a removed user".
   */
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const workspaces = pgTable("workspaces", {
  id: id(),
  /** Tenant. Maps 1:1 to a Clerk organization (source of truth for membership/invites). */
  clerkOrgId: text("clerk_org_id").notNull().unique(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  /**
   * Zone used to bucket days in reports for the whole org. When null, reports
   * use the timezone of the user generating them.
   */
  reportTimezone: text("report_timezone"),
  /** Logical deletion: set when the Clerk organization is deleted. Data is retained, access is blocked. */
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRole("role").notNull().default("member"),
    /** Logical removal: the member lost access but their entries remain. Re-joining clears it. */
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("workspace_members_ws_user_uq").on(t.workspaceId, t.userId)],
);

// ---------------------------------------------------------------- catalog

export const organizations = pgTable(
  "organizations",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("organizations_ws_name_uq").on(t.workspaceId, t.name),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** An organization (own company, a client, ...) has many projects; a project belongs to exactly one. */
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#3B82F6"),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("projects_org_name_uq").on(t.organizationId, t.name),
    index("projects_ws_idx").on(t.workspaceId),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isCompleted: boolean("is_completed").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("tasks_project_name_uq").on(t.projectId, t.name),
    index("tasks_ws_idx").on(t.workspaceId),
  ],
);

/**
 * Who takes part in a project (access model, ADR-030). Members may log hours only in projects they take
 * part in and see only those projects' tasks; admins are not restricted by it. Added/removed by admins only.
 */
export const projectMembers = pgTable(
  "project_members",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("project_members_project_user_uq").on(t.projectId, t.userId),
    index("project_members_ws_user_idx").on(t.workspaceId, t.userId),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#6B7280"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("tags_ws_name_uq").on(t.workspaceId, t.name)],
);

// ---------------------------------------------------------------- tracking

export const timeEntries = pgTable(
  "time_entries",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Nullable: a timer may be started before choosing a project. */
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    taskId: uuid("task_id").references(() => tasks.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull().default(""),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    /** NULL while the timer is running. */
    endedAt: timestamp("ended_at", { withTimezone: true }),
    /** IANA zone of the user when the entry was recorded (fidelity for reports). */
    timezone: text("timezone").notNull(),
    isBillable: boolean("is_billable").notNull().default(true),
    /** Logical deletion: the entry is hidden everywhere and can be restored. A deleted entry never counts as the running timer. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "time_entries_end_after_start",
      sql`${t.endedAt} is null or ${t.endedAt} > ${t.startedAt}`,
    ),
    // At most one running (and not deleted) timer per user, across all workspaces.
    uniqueIndex("time_entries_one_running_per_user_uq")
      .on(t.userId)
      .where(sql`${t.endedAt} is null and ${t.deletedAt} is null`),
    index("time_entries_ws_user_start_idx").on(
      t.workspaceId,
      t.userId,
      t.startedAt,
    ),
    index("time_entries_ws_project_start_idx").on(
      t.workspaceId,
      t.projectId,
      t.startedAt,
    ),
  ],
);

export const timeEntryTags = pgTable(
  "time_entry_tags",
  {
    timeEntryId: uuid("time_entry_id")
      .notNull()
      .references(() => timeEntries.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.timeEntryId, t.tagId] }),
    index("time_entry_tags_tag_idx").on(t.tagId),
  ],
);
