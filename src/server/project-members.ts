import { and, asc, eq, inArray, isNull, notInArray, type SQL, sql } from "drizzle-orm";
import { organizations, projectMembers, projects, users, workspaceMembers } from "@/db/schema";
import { displayName } from "@/lib/display-name";
import { ForbiddenError, NotFoundError } from "./errors";
import type { TenantContext, TenantDb } from "./tenant";

export type MemberOverview = Participant & {
  projects: { id: string; name: string; color: string; clientName: string; isArchived: boolean }[];
};
export type Participant = { userId: string; name: string; email: string; role: "admin" | "member" };

/**
 * Who takes part in which project (ADR-030). The rule it feeds:
 *  - admins are never restricted: they may use every project;
 *  - members may log hours only in projects they take part in, and see only those projects' tasks.
 * Only admins change it. Membership rows are access configuration, not history: removing one does not touch
 * time entries already logged.
 */
export function createProjectMembers(db: TenantDb, ctx: TenantContext, deps: { getProject: (id: string) => Promise<unknown> }) {
  const ws = ctx.workspaceId;
  const requireAdmin = () => {
    if (ctx.role !== "admin") throw new ForbiddenError("Only workspace admins can manage project participants");
  };

  /** Active (not removed, not anonymized) members of this workspace, with their role, optionally narrowed by `extra`. */
  const activeMembers = (extra?: SQL) =>
    db
      .select({ userId: users.id, name: users.name, email: users.email, deletedAt: users.deletedAt, role: workspaceMembers.role })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(and(eq(workspaceMembers.workspaceId, ws), isNull(workspaceMembers.removedAt), isNull(users.deletedAt), extra))
      .orderBy(asc(sql`lower(coalesce(${users.name}, ${users.email}))`));

  const participantIds = (projectId: string) =>
    db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(and(eq(projectMembers.workspaceId, ws), eq(projectMembers.projectId, projectId)));

  const toParticipant = (r: { userId: string; name: string | null; email: string; deletedAt: Date | null; role: "admin" | "member" }): Participant => ({
    userId: r.userId,
    name: displayName(r),
    email: r.email,
    role: r.role,
  });

  return {
    /** Ids of the projects the caller takes part in. Admins are restricted by none: `null` means "all". */
    async myProjectIds(): Promise<string[] | null> {
      if (ctx.role === "admin") return null;
      const rows = await db
        .select({ projectId: projectMembers.projectId })
        .from(projectMembers)
        .where(and(eq(projectMembers.workspaceId, ws), eq(projectMembers.userId, ctx.userId)));
      return rows.map((r) => r.projectId);
    },

    /** Whether the caller may use `projectId` for new work. */
    async canUse(projectId: string): Promise<boolean> {
      if (ctx.role === "admin") return true;
      const [row] = await db
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(and(eq(projectMembers.workspaceId, ws), eq(projectMembers.projectId, projectId), eq(projectMembers.userId, ctx.userId)));
      return Boolean(row);
    },

    async list(projectId: string): Promise<Participant[]> {
      requireAdmin();
      await deps.getProject(projectId);
      return (await activeMembers(inArray(users.id, participantIds(projectId)))).map(toParticipant);
    },

    /** Active members who are not yet in the project (to offer in the "add" picker). */
    async candidates(projectId: string): Promise<Participant[]> {
      requireAdmin();
      await deps.getProject(projectId);
      return (await activeMembers(notInArray(users.id, participantIds(projectId)))).map(toParticipant);
    },

    /** Every active member with the projects they take part in (admins see all projects regardless, so theirs is informational). */
    async overview(): Promise<MemberOverview[]> {
      requireAdmin();
      const [members, links] = await Promise.all([
        activeMembers(),
        db
          .select({
            userId: projectMembers.userId,
            id: projects.id,
            name: projects.name,
            color: projects.color,
            isArchived: projects.isArchived,
            clientName: organizations.name,
          })
          .from(projectMembers)
          .innerJoin(projects, eq(projects.id, projectMembers.projectId))
          .innerJoin(organizations, eq(organizations.id, projects.organizationId))
          .where(and(eq(projectMembers.workspaceId, ws), eq(projects.workspaceId, ws)))
          .orderBy(asc(organizations.name), asc(projects.name)),
      ]);
      return members.map((m) => ({
        ...toParticipant(m),
        projects: links.filter((l) => l.userId === m.userId).map((l) => ({ id: l.id, name: l.name, color: l.color, clientName: l.clientName, isArchived: l.isArchived })),
      }));
    },

    async add(projectId: string, userId: string): Promise<void> {
      requireAdmin();
      await deps.getProject(projectId);
      const [member] = await activeMembers(eq(users.id, userId));
      if (!member) throw new NotFoundError("Member");
      await db.insert(projectMembers).values({ workspaceId: ws, projectId, userId }).onConflictDoNothing();
    },

    async remove(projectId: string, userId: string): Promise<void> {
      requireAdmin();
      await deps.getProject(projectId);
      await db.delete(projectMembers).where(and(eq(projectMembers.workspaceId, ws), eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
    },
  };
}
