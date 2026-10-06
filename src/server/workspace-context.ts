import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users, workspaceMembers, workspaces } from "@/db/schema";
import { roleFromClerk, type WorkspaceRole } from "@/lib/roles";
import { slugify } from "@/lib/slug";
import { isStale } from "@/lib/stale";

/**
 * Stopgap until Clerk webhooks exist: profile/organization changes made in
 * Clerk (name, avatar, org name, role) are pulled in at most this often.
 */
const RESYNC_AFTER_MS = 10 * 60_000;

/** Who is acting, in which workspace, and with which role. Every query must be scoped by `workspaceId`. */
export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  timezone: string;
  userName: string | null;
  workspaceName: string;
};

/**
 * Resolves the signed-in user and active Clerk organization into our own
 * user/workspace/membership rows, creating them on first access (lazy
 * provisioning). Idempotent: concurrent first requests converge on the same
 * rows. Webhooks will later keep these rows in sync using the same upserts.
 *
 * Redirects to sign-in when signed out and to /onboarding when the user has
 * no active organization.
 */
export async function requireWorkspaceContext(): Promise<WorkspaceContext> {
  const { userId: clerkUserId, orgId: clerkOrgId, orgRole, redirectToSignIn } = await auth();
  if (!clerkUserId) return redirectToSignIn();
  if (!clerkOrgId) redirect("/onboarding");

  const role = roleFromClerk(orgRole);
  const existing = await findContext(clerkUserId, clerkOrgId);
  if (existing && existing.role === role && !isStale(existing.syncedAt, new Date(), RESYNC_AFTER_MS)) {
    return existing.context;
  }
  return provision(clerkUserId, clerkOrgId, role);
}

async function findContext(
  clerkUserId: string,
  clerkOrgId: string,
): Promise<{ context: WorkspaceContext; role: WorkspaceRole; syncedAt: Date } | null> {
  const [row] = await getDb()
    .select({
      userId: users.id,
      userName: users.name,
      timezone: users.timezone,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      role: workspaceMembers.role,
      syncedAt: users.updatedAt,
    })
    .from(users)
    .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(users.clerkId, clerkUserId), eq(workspaces.clerkOrgId, clerkOrgId)))
    .limit(1);
  if (!row) return null;
  const { role, syncedAt, ...context } = row;
  return { context: { ...context, role }, role, syncedAt };
}

async function provision(
  clerkUserId: string,
  clerkOrgId: string,
  role: WorkspaceRole,
): Promise<WorkspaceContext> {
  const db = getDb();

  const clerkUser = await currentUser();
  if (!clerkUser || clerkUser.id !== clerkUserId) throw new Error("Clerk user not found");
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) throw new Error("Clerk user has no email address");
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;
  const now = new Date();

  // neon-http has no interactive transactions: three idempotent upserts, in dependency order.
  const [user] = await db
    .insert(users)
    .values({ clerkId: clerkUserId, email, name, avatarUrl: clerkUser.imageUrl })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: { email, name, avatarUrl: clerkUser.imageUrl, updatedAt: now },
    })
    .returning();

  const org = await (await clerkClient()).organizations.getOrganization({ organizationId: clerkOrgId });
  const [workspace] = await db
    .insert(workspaces)
    .values({
      clerkOrgId,
      name: org.name,
      // The suffix keeps the (unique) slug collision-free across organizations with the same name.
      slug: `${slugify(org.slug ?? org.name, 40)}-${clerkOrgId.slice(-6).toLowerCase()}`,
    })
    .onConflictDoUpdate({ target: workspaces.clerkOrgId, set: { name: org.name, updatedAt: now } })
    .returning();

  await db
    .insert(workspaceMembers)
    .values({ workspaceId: workspace.id, userId: user.id, role })
    .onConflictDoUpdate({
      target: [workspaceMembers.workspaceId, workspaceMembers.userId],
      set: { role, updatedAt: now },
    });

  return {
    userId: user.id,
    workspaceId: workspace.id,
    role,
    timezone: user.timezone,
    userName: user.name,
    workspaceName: workspace.name,
  };
}
