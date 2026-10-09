import { and, asc, eq, inArray, isNull, notInArray, type SQL, sql } from "drizzle-orm";
import { organizations, projectMembers, projects, users, workspaceMembers } from "@/db/schema";
import { displayName } from "@/lib/display-name";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
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

    /** Active (not archived) projects with their client, to offer in the "projects of this member" picker. */
    async assignableProjects(): Promise<{ id: string; name: string; color: string; clientName: string }[]> {
      requireAdmin();
      return db
        .select({ id: projects.id, name: projects.name, color: projects.color, clientName: organizations.name })
        .from(projects)
        .innerJoin(organizations, eq(organizations.id, projects.organizationId))
        .where(and(eq(projects.workspaceId, ws), eq(projects.isArchived, false)))
        .orderBy(asc(organizations.name), asc(projects.name));
    },

    /**
     * Sets, in one go, which active projects a member takes part in. Archived projects are left as they are, and hours
     * already logged are never touched. Admins are unrestricted, so there is nothing to set for them. Not atomic
     * (neon-http): additions run first, so an interruption never leaves the person with fewer projects than before.
     */
    async setForMember(userId: string, projectIds: string[]): Promise<void> {
      requireAdmin();
      const [member] = await activeMembers(eq(users.id, userId));
      if (!member) throw new NotFoundError("Member");
      if (member.role === "admin") throw new ValidationError({ userId: "Administradores já têm acesso a todos os projetos." });

      const active = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.workspaceId, ws), eq(projects.isArchived, false)));
      const activeIds = active.map((p) => p.id);
      const wanted = [...new Set(projectIds)];
      if (wanted.some((id) => !activeIds.includes(id))) throw new NotFoundError("Project");

      if (wanted.length > 0) {
        await db
          .insert(projectMembers)
          .values(wanted.map((projectId) => ({ workspaceId: ws, projectId, userId })))
          .onConflictDoNothing();
      }
      const unwanted = activeIds.filter((id) => !wanted.includes(id));
      if (unwanted.length > 0) {
        await db
          .delete(projectMembers)
          .where(and(eq(projectMembers.workspaceId, ws), eq(projectMembers.userId, userId), inArray(projectMembers.projectId, unwanted)));
      }
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
