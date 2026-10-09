import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, type Db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { users, workspaceMembers, workspaces } from "@/db/schema";
import { slugify } from "@/lib/slug";
import type { WorkspaceRole } from "@/lib/roles";
import type { WorkspaceContext } from "@/server/workspace-context";
import { getAuth } from "./auth";

/** The plugin stores comma-separated roles; owner and admin both administer the workspace. */
export function roleFromAuth(role: string | null | undefined): WorkspaceRole {
  const roles = (role ?? "").split(",").map((r) => r.trim());
  return roles.includes("owner") || roles.includes("admin") ? "admin" : "member";
}

export type AuthSessionLike = {
  user: { id: string; email: string; name?: string | null; image?: string | null };
  session: { activeOrganizationId?: string | null };
};

export type ContextResult =
  | { kind: "ok"; context: WorkspaceContext }
  /** Signed in but no active organization: onboarding. */
  | { kind: "no-org" }
  /** The active organization is stale: the user is no longer a member. */
  | { kind: "no-membership" }
  /** The person was deleted (LGPD tombstone): never resurrected. */
  | { kind: "deleted" }
  /** The workspace was archived: access blocked, data retained. */
  | { kind: "archived" };

/**
 * Same contract as the Clerk flow (`requireWorkspaceContext`): turns a Better Auth session into our own
 * user/workspace/membership rows, creating them on first access. neon-http has no transactions, so every step is
 * one idempotent statement and concurrent first requests converge on the same rows.
 */
export async function resolveWorkspaceContext(db: Db, session: AuthSessionLike): Promise<ContextResult> {
  const orgId = session.session.activeOrganizationId;
  if (!orgId) return { kind: "no-org" };

  const [row] = await db
    .select({ role: authSchema.member.role, orgName: authSchema.organization.name, orgSlug: authSchema.organization.slug })
    .from(authSchema.member)
    .innerJoin(authSchema.organization, eq(authSchema.organization.id, authSchema.member.organizationId))
    .where(and(eq(authSchema.member.userId, session.user.id), eq(authSchema.member.organizationId, orgId)))
    .limit(1);
  if (!row) return { kind: "no-membership" };

  const user = await ensureUser(db, session.user);
  if (!user) return { kind: "deleted" };

  const [workspace] = await db
    .insert(workspaces)
    .values({ authOrgId: orgId, name: row.orgName, slug: `${slugify(row.orgSlug, 40)}-${orgId.slice(-6).toLowerCase()}` })
    // Slug is set once on insert and never changes. An archived workspace is never un-archived here.
    .onConflictDoUpdate({ target: workspaces.authOrgId, set: { name: row.orgName, updatedAt: new Date() } })
    .returning();
  if (workspace.archivedAt) return { kind: "archived" };

  const role = roleFromAuth(row.role);
  await db
    .insert(workspaceMembers)
    .values({ workspaceId: workspace.id, userId: user.id, role })
    .onConflictDoUpdate({
      target: [workspaceMembers.workspaceId, workspaceMembers.userId],
      set: { role, removedAt: null, updatedAt: new Date() },
    });

  return {
    kind: "ok",
    context: { userId: user.id, workspaceId: workspace.id, role, timezone: user.timezone, userName: user.name, workspaceName: workspace.name },
  };
}

/** By `auth_id`; else links an existing person by e-mail (migrated or first social login); else creates. Null = deleted. */
async function ensureUser(db: Db, authUser: AuthSessionLike["user"]) {
  const email = authUser.email.trim().toLowerCase();
  const profile = { name: authUser.name?.trim() || null, avatarUrl: authUser.image ?? null };

  const [byAuthId] = await db.select().from(users).where(eq(users.authId, authUser.id));
  if (byAuthId) {
    if (byAuthId.deletedAt) return null;
    const changed = (profile.name && profile.name !== byAuthId.name) || profile.avatarUrl !== byAuthId.avatarUrl;
    if (!changed) return byAuthId;
    const [updated] = await db
      .update(users)
      .set({ name: profile.name ?? byAuthId.name, avatarUrl: profile.avatarUrl, updatedAt: new Date() })
      .where(eq(users.id, byAuthId.id))
      .returning();
    return updated;
  }

  const [byEmail] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`);
  if (byEmail) {
    if (byEmail.deletedAt) return null;
    const [linked] = await db
      .update(users)
      .set({ authId: authUser.id, name: byEmail.name ?? profile.name, avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl, updatedAt: new Date() })
      .where(eq(users.id, byEmail.id))
      .returning();
    return linked;
  }

  const [created] = await db
    .insert(users)
    .values({ authId: authUser.id, email, ...profile })
    .onConflictDoUpdate({ target: users.authId, set: { updatedAt: new Date() } })
    .returning();
  return created;
}

/** Page/action entry point. Not used by the app until the login swap (PR 2). */
export async function requireAuthWorkspaceContext(): Promise<WorkspaceContext> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const result = await resolveWorkspaceContext(getDb(), session);
  switch (result.kind) {
    case "ok":
      return result.context;
    case "no-org":
    case "no-membership":
      return redirect("/onboarding");
    default:
      return redirect("/sign-in?error=unavailable");
  }
}
