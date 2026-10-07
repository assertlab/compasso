import { and, asc, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { z } from "zod";
import * as schema from "@/db/schema";
import { organizations, projects, tags, tasks } from "@/db/schema";
import {
  organizationInput,
  organizationPatch,
  projectInput,
  projectPatch,
  tagInput,
  tagPatch,
  taskInput,
  taskPatch,
} from "@/lib/schemas/catalog";
import type { WorkspaceRole } from "@/lib/roles";
import { ForbiddenError, NotFoundError } from "./errors";
import { createTimeEntries } from "./time-entries";

// Any Drizzle Postgres driver (neon-http in production, PGlite in tests).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TenantDb = PgDatabase<any, typeof schema>;

export type TenantContext = { userId: string; workspaceId: string; role: WorkspaceRole; timezone: string };

const hasChanges = (patch: object) => Object.values(patch).some((v) => v !== undefined);

/**
 * Workspace-scoped data access (ADR-026). Everything a request reads or writes
 * in a workspace goes through here, so no caller writes `where workspace_id`
 * by hand:
 *  - every read and every update/delete-like statement is filtered by the session's workspace;
 *  - `workspace_id` is always stamped from the session, never from input;
 *  - ids that point at other rows (organization of a project, project of a task)
 *    are verified to belong to the same workspace before use;
 *  - rows of other workspaces behave exactly like missing rows (NotFoundError);
 *  - writes to the catalog are admin-only; reads are open to every member;
 *  - there is no physical delete: use archive/complete flags (ADR-025 spirit).
 */
export function createTenant(db: TenantDb, ctx: TenantContext, opts: { now?: () => Date } = {}) {
  const ws = ctx.workspaceId;

  function requireAdmin() {
    if (ctx.role !== "admin") throw new ForbiddenError("Only workspace admins can change the catalog");
  }

  async function getOrganization(id: string) {
    const [row] = await db
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, id), eq(organizations.workspaceId, ws)));
    if (!row) throw new NotFoundError("Organization");
    return row;
  }

  async function getProject(id: string) {
    const [row] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.workspaceId, ws)));
    if (!row) throw new NotFoundError("Project");
    return row;
  }

  async function getTask(id: string) {
    const [row] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
    if (!row) throw new NotFoundError("Task");
    return row;
  }

  async function getTag(id: string) {
    const [row] = await db
      .select()
      .from(tags)
      .where(and(eq(tags.id, id), eq(tags.workspaceId, ws)));
    if (!row) throw new NotFoundError("Tag");
    return row;
  }

  return {
    timeEntries: createTimeEntries(db, ctx, { now: opts.now ?? (() => new Date()), getProject, getTask }),

    organizations: {
      list: ({ includeArchived = false } = {}) =>
        db
          .select()
          .from(organizations)
          .where(and(eq(organizations.workspaceId, ws), includeArchived ? undefined : eq(organizations.isArchived, false)))
          .orderBy(asc(organizations.name)),
      get: getOrganization,
      async create(input: z.input<typeof organizationInput>) {
        requireAdmin();
        const data = organizationInput.parse(input);
        const [row] = await db.insert(organizations).values({ ...data, workspaceId: ws }).returning();
        return row;
      },
      async update(id: string, patch: z.input<typeof organizationPatch>) {
        requireAdmin();
        const data = organizationPatch.parse(patch);
        if (!hasChanges(data)) return getOrganization(id);
        const [row] = await db
          .update(organizations)
          .set(data)
          .where(and(eq(organizations.id, id), eq(organizations.workspaceId, ws)))
          .returning();
        if (!row) throw new NotFoundError("Organization");
        return row;
      },
    },

    projects: {
      list: ({ organizationId, includeArchived = false }: { organizationId?: string; includeArchived?: boolean } = {}) =>
        db
          .select()
          .from(projects)
          .where(
            and(
              eq(projects.workspaceId, ws),
              organizationId ? eq(projects.organizationId, organizationId) : undefined,
              includeArchived ? undefined : eq(projects.isArchived, false),
            ),
          )
          .orderBy(asc(projects.name)),
      get: getProject,
      async create(input: z.input<typeof projectInput>) {
        requireAdmin();
        const data = projectInput.parse(input);
        await getOrganization(data.organizationId); // must belong to this workspace
        const [row] = await db.insert(projects).values({ ...data, workspaceId: ws }).returning();
        return row;
      },
      async update(id: string, patch: z.input<typeof projectPatch>) {
        requireAdmin();
        const data = projectPatch.parse(patch);
        if (data.organizationId) await getOrganization(data.organizationId);
        if (!hasChanges(data)) return getProject(id);
        const [row] = await db
          .update(projects)
          .set(data)
          .where(and(eq(projects.id, id), eq(projects.workspaceId, ws)))
          .returning();
        if (!row) throw new NotFoundError("Project");
        return row;
      },
    },

    tasks: {
      async list(projectId: string, { includeCompleted = true } = {}) {
        await getProject(projectId); // a foreign project id is "not found", not an empty list
        return db
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.workspaceId, ws),
              eq(tasks.projectId, projectId),
              includeCompleted ? undefined : eq(tasks.isCompleted, false),
            ),
          )
          .orderBy(asc(tasks.name));
      },
      get: getTask,
      async create(input: z.input<typeof taskInput>) {
        requireAdmin();
        const data = taskInput.parse(input);
        await getProject(data.projectId);
        const [row] = await db.insert(tasks).values({ ...data, workspaceId: ws }).returning();
        return row;
      },
      async update(id: string, patch: z.input<typeof taskPatch>) {
        requireAdmin();
        const data = taskPatch.parse(patch);
        if (!hasChanges(data)) return getTask(id);
        const [row] = await db
          .update(tasks)
          .set(data)
          .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)))
          .returning();
        if (!row) throw new NotFoundError("Task");
        return row;
      },
    },

    tags: {
      list: () => db.select().from(tags).where(eq(tags.workspaceId, ws)).orderBy(asc(tags.name)),
      get: getTag,
      async create(input: z.input<typeof tagInput>) {
        requireAdmin();
        const data = tagInput.parse(input);
        const [row] = await db.insert(tags).values({ ...data, workspaceId: ws }).returning();
        return row;
      },
      async update(id: string, patch: z.input<typeof tagPatch>) {
        requireAdmin();
        const data = tagPatch.parse(patch);
        if (!hasChanges(data)) return getTag(id);
        const [row] = await db
          .update(tags)
          .set(data)
          .where(and(eq(tags.id, id), eq(tags.workspaceId, ws)))
          .returning();
        if (!row) throw new NotFoundError("Tag");
        return row;
      },
    },
  };
}

export type Tenant = ReturnType<typeof createTenant>;
