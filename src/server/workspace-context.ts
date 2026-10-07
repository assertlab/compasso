import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users, workspaceMembers, workspaces } from "@/db/schema";
import { roleFromClerk, type WorkspaceRole } from "@/lib/roles";
import { userFromClerk, workspaceFromClerk } from "@/lib/clerk-mappers";
import { isStale } from "@/lib/stale";
import { upsertMembership, upsertUser, upsertWorkspace } from "@/server/clerk-sync";

/**
 * Safety net next to the Clerk webhook: if a webhook is missed, profile and
 * organization changes made in Clerk are still pulled in at most this often.
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
 * rows. The Clerk webhook keeps these rows in sync using the same upserts (src/server/clerk-sync.ts).
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
    .where(
      and(
        eq(users.clerkId, clerkUserId),
        eq(workspaces.clerkOrgId, clerkOrgId),
        // logically removed members / archived workspaces / anonymized users have no access
        isNull(workspaceMembers.removedAt),
        isNull(workspaces.archivedAt),
        isNull(users.deletedAt),
      ),
    )
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
  const clerkUser = await currentUser();
  if (!clerkUser || clerkUser.id !== clerkUserId) throw new Error("Clerk user not found");
  const userData = userFromClerk({
    id: clerkUser.id,
    first_name: clerkUser.firstName,
    last_name: clerkUser.lastName,
    image_url: clerkUser.imageUrl,
    primary_email_address_id: clerkUser.primaryEmailAddressId,
    email_addresses: clerkUser.emailAddresses.map((e) => ({ id: e.id, email_address: e.emailAddress })),
  });
  if (!userData) throw new Error("Clerk user has no email address");
  const org = await (await clerkClient()).organizations.getOrganization({ organizationId: clerkOrgId });

  // neon-http has no interactive transactions: three idempotent upserts, in dependency order.
  const user = await upsertUser(userData);
  if (!user) throw new Error("User was deleted");
  // Clerk just confirmed the organization exists, so this is the one place that may un-archive it.
  const workspace = await upsertWorkspace(workspaceFromClerk(org), { unarchive: true });
  await upsertMembership(workspace.id, user.id, role);

  return {
    userId: user.id,
    workspaceId: workspace.id,
    role,
    timezone: user.timezone,
    userName: user.name,
    workspaceName: workspace.name,
  };
}
