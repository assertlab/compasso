import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb, type Db } from "@/db";
import { organizations, projects, tags, tasks, timeEntries, timeEntryTags, users, workspaceMembers, workspaces } from "@/db/schema";
import { PERSONAL_EXPORT_VERSION, personalExportSchema, type PersonalExport } from "@/lib/schemas/personal-export";

/**
 * "Exportar meus dados" (ADR-037): everything that is the person's own, across workspaces, as one JSON document.
 * Everything is selected by `userId` (which the caller takes from the session, never from input), so nothing of anyone
 * else can come in: no other people's entries, e-mails or memberships, and no correction history written by admins.
 * The catalog (clients, projects, tasks, tags) is included only as far as the person's own entries reference it.
 * Like `anonymizeAccount` it reads across workspaces on purpose: these rows are the person's, not a workspace's view.
 */
export async function buildPersonalExport(db: Db, userId: string, opts: { now?: Date; version?: string } = {}): Promise<PersonalExport> {
  const now = opts.now ?? new Date();
  const mine = db.select({ id: timeEntries.id }).from(timeEntries).where(eq(timeEntries.userId, userId));
  const [account] = await db.select({ name: users.name, email: users.email, timezone: users.timezone }).from(users).where(eq(users.id, userId));
  if (!account) throw new Error("User not found");

  const [entryRows, links, memberships] = await Promise.all([
    db.select().from(timeEntries).where(eq(timeEntries.userId, userId)).orderBy(asc(timeEntries.startedAt), asc(timeEntries.id)),
    db.select({ entryId: timeEntryTags.timeEntryId, tagId: timeEntryTags.tagId }).from(timeEntryTags).where(inArray(timeEntryTags.timeEntryId, mine)),
    db
      .select({ workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.userId, userId), isNull(workspaceMembers.removedAt))),
  ]);

  const usedProjects = db.select({ id: timeEntries.projectId }).from(timeEntries).where(eq(timeEntries.userId, userId));
  const usedTasks = db.select({ id: timeEntries.taskId }).from(timeEntries).where(eq(timeEntries.userId, userId));
  // A used task always brings its project along, so every reference in the file resolves.
  const projectIds = db
    .select({ id: projects.id })
    .from(projects)
    .where(or(inArray(projects.id, usedProjects), inArray(projects.id, db.select({ id: tasks.projectId }).from(tasks).where(inArray(tasks.id, usedTasks)))));
  const usedTags = db.select({ id: timeEntryTags.tagId }).from(timeEntryTags).where(inArray(timeEntryTags.timeEntryId, mine));
  const entryWorkspaces = db.select({ id: timeEntries.workspaceId }).from(timeEntries).where(eq(timeEntries.userId, userId));
  const memberWorkspaces = db
    .select({ id: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, userId), isNull(workspaceMembers.removedAt)));

  const [workspaceRows, projectRows, taskRows, tagRows] = await Promise.all([
    db
      .select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .where(or(inArray(workspaces.id, entryWorkspaces), inArray(workspaces.id, memberWorkspaces)))
      .orderBy(asc(workspaces.name), asc(workspaces.id)),
    db.select().from(projects).where(inArray(projects.id, projectIds)).orderBy(asc(projects.name), asc(projects.id)),
    db.select().from(tasks).where(inArray(tasks.id, usedTasks)).orderBy(asc(tasks.name), asc(tasks.id)),
    db.select().from(tags).where(inArray(tags.id, usedTags)).orderBy(asc(tags.name), asc(tags.id)),
  ]);
  const clientRows = projectRows.length
    ? await db
        .select()
        .from(organizations)
        .where(inArray(organizations.id, db.select({ id: projects.organizationId }).from(projects).where(inArray(projects.id, projectIds))))
        .orderBy(asc(organizations.name), asc(organizations.id))
    : [];

  // File-local keys, unique across the whole file.
  const keys = new Map<string, string>();
  const counters: Record<string, number> = {};
  const keyOf = (prefix: string, id: string) => {
    let k = keys.get(id);
    if (!k) {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      k = `${prefix}${counters[prefix]}`;
      keys.set(id, k);
    }
    return k;
  };
  const roleIn = new Map(memberships.map((m) => [m.workspaceId, m.role]));
  const tagKeysOf = new Map<string, string[]>();
  for (const l of links) tagKeysOf.set(l.entryId, [...(tagKeysOf.get(l.entryId) ?? []), l.tagId]);
  const iso = (d: Date | null) => (d ? d.toISOString() : null);

  const data: PersonalExport = {
    schemaVersion: PERSONAL_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    generator: { name: "compasso", version: opts.version ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0" },
    account: { name: account.name, email: account.email, timezone: account.timezone },
    workspaces: workspaceRows.map((w) => ({
      key: keyOf("w", w.id),
      name: w.name,
      role: roleIn.get(w.id) ?? null,
      clients: clientRows.filter((c) => c.workspaceId === w.id).map((c) => ({ key: keyOf("c", c.id), name: c.name, archived: c.isArchived })),
      projects: projectRows
        .filter((p) => p.workspaceId === w.id)
        .map((p) => ({ key: keyOf("p", p.id), clientKey: keyOf("c", p.organizationId), name: p.name, color: p.color, archived: p.isArchived })),
      tasks: taskRows
        .filter((t) => t.workspaceId === w.id)
        .map((t) => ({ key: keyOf("t", t.id), projectKey: keyOf("p", t.projectId), name: t.name, completed: t.isCompleted })),
      tags: tagRows.filter((t) => t.workspaceId === w.id).map((t) => ({ key: keyOf("g", t.id), name: t.name, color: t.color })),
      entries: entryRows
        .filter((e) => e.workspaceId === w.id)
        .map((e) => ({
          projectKey: e.projectId ? keyOf("p", e.projectId) : null,
          taskKey: e.taskId ? keyOf("t", e.taskId) : null,
          tagKeys: (tagKeysOf.get(e.id) ?? []).map((id) => keyOf("g", id)),
          description: e.description,
          startedAt: e.startedAt.toISOString(),
          endedAt: iso(e.endedAt),
          timezone: e.timezone,
          billable: e.isBillable,
          deletedAt: iso(e.deletedAt),
        })),
    })),
  };
  // The contract is checked on the way out: a bug here fails loudly instead of handing the person a broken file.
  return personalExportSchema.parse(data);
}

export const getPersonalExport = (userId: string) => buildPersonalExport(getDb(), userId);

export function personalExportFileName(now: Date): string {
  return `compasso-meus-dados-${now.toISOString().slice(0, 10)}.json`;
}
