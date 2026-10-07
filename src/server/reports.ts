import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { organizations, projects, tasks, timeEntries, users, workspaceMembers } from "@/db/schema";
import { displayName } from "@/lib/display-name";
import { entryDurationSeconds } from "@/lib/time";
import type { ReportRow } from "@/lib/report";
import { ForbiddenError } from "./errors";
import type { TenantContext, TenantDb } from "./tenant";

export type ReportFilter = {
  /** Entries starting in [from, to). */
  from: Date;
  to: Date;
  clientId?: string;
  /** A project id, or "none" for entries without a project (then client/task are ignored). */
  projectId?: string | "none";
  taskId?: string;
  /** Empty/undefined = everyone the caller may see. */
  userIds?: string[];
};

export type Person = { id: string; name: string; isRemoved: boolean };

/**
 * Read-only reporting over time entries (ADR-030). Visibility follows ADR-029:
 *  - a member only ever sees their own hours: asking for anyone else is an error, not a silent empty result;
 *  - an admin sees every member of the workspace, optionally narrowed to some people.
 * Only finished entries are summed; running timers are counted separately so the UI can warn about them.
 * Deleted entries never appear. Every query is scoped to the workspace.
 */
export function createReports(db: TenantDb, ctx: TenantContext) {
  const ws = ctx.workspaceId;

  function resolveUsers(requested: string[] | undefined): string[] | null {
    const ids = [...new Set(requested ?? [])];
    if (ctx.role === "admin") return ids.length > 0 ? ids : null;
    if (ids.some((id) => id !== ctx.userId)) throw new ForbiddenError("Members can only report their own hours");
    return [ctx.userId];
  }

  return {
    /** People the caller may filter by: every member for admins (including removed ones, who may have history), just themselves otherwise. */
    async people(): Promise<Person[]> {
      const rows = await db
        .select({ id: users.id, name: users.name, email: users.email, deletedAt: users.deletedAt, removedAt: workspaceMembers.removedAt })
        .from(workspaceMembers)
        .innerJoin(users, eq(users.id, workspaceMembers.userId))
        .where(and(eq(workspaceMembers.workspaceId, ws), ctx.role === "admin" ? undefined : eq(users.id, ctx.userId)))
        .orderBy(asc(users.name), asc(users.email));
      return rows.map((r) => ({ id: r.id, name: displayName(r), isRemoved: r.removedAt !== null || r.deletedAt !== null }));
    },

    async run(filter: ReportFilter): Promise<{ rows: ReportRow[]; runningCount: number }> {
      const userIds = resolveUsers(filter.userIds);
      const noProject = filter.projectId === "none";
      const where = (finished: boolean) =>
        and(
          eq(timeEntries.workspaceId, ws),
          isNull(timeEntries.deletedAt),
          finished ? isNotNull(timeEntries.endedAt) : isNull(timeEntries.endedAt),
          gte(timeEntries.startedAt, filter.from),
          lt(timeEntries.startedAt, filter.to),
          userIds ? inArray(timeEntries.userId, userIds) : undefined,
          noProject ? isNull(timeEntries.projectId) : undefined,
          !noProject && filter.projectId ? eq(timeEntries.projectId, filter.projectId) : undefined,
          !noProject && filter.taskId ? eq(timeEntries.taskId, filter.taskId) : undefined,
          !noProject && filter.clientId ? eq(projects.organizationId, filter.clientId) : undefined,
        );

      const base = () =>
        db
          .select({
            id: timeEntries.id,
            userId: timeEntries.userId,
            userName: users.name,
            userEmail: users.email,
            userDeletedAt: users.deletedAt,
            clientId: organizations.id,
            clientName: organizations.name,
            projectId: projects.id,
            projectName: projects.name,
            taskId: tasks.id,
            taskName: tasks.name,
            description: timeEntries.description,
            startedAt: timeEntries.startedAt,
            endedAt: timeEntries.endedAt,
          })
          .from(timeEntries)
          .innerJoin(users, eq(users.id, timeEntries.userId))
          .leftJoin(projects, and(eq(projects.id, timeEntries.projectId), eq(projects.workspaceId, ws)))
          .leftJoin(organizations, and(eq(organizations.id, projects.organizationId), eq(organizations.workspaceId, ws)))
          .leftJoin(tasks, and(eq(tasks.id, timeEntries.taskId), eq(tasks.workspaceId, ws)));

      const [finished, running] = await Promise.all([
        base().where(where(true)).orderBy(desc(timeEntries.startedAt)),
        base().where(where(false)),
      ]);

      const rows = finished.map<ReportRow>((r) => ({
        id: r.id,
        userId: r.userId,
        userName: displayName({ name: r.userName, email: r.userEmail, deletedAt: r.userDeletedAt }),
        clientId: r.clientId,
        clientName: r.clientName,
        projectId: r.projectId,
        projectName: r.projectName,
        taskId: r.taskId,
        taskName: r.taskName,
        description: r.description,
        startedAt: r.startedAt,
        endedAt: r.endedAt as Date,
        seconds: entryDurationSeconds(r.startedAt, r.endedAt),
      }));
      return { rows, runningCount: running.length };
    },
  };
}
