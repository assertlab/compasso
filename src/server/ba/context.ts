import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { slugify } from "@/lib/slug";
import { upsertMembership, upsertUser, upsertWorkspace } from "@/server/clerk-sync";
import type { WorkspaceContext } from "@/server/workspace-context";
import type { WorkspaceRole } from "@/lib/roles";
import { getAuth } from "./auth";

/**
 * SPIKE (ADR-033): same contract as `requireWorkspaceContext()` (Clerk), fed by Better Auth.
 * To avoid migrating public tables during the spike, Better Auth ids are mirrored into the existing
 * `users.clerk_id` / `workspaces.clerk_org_id` columns with a "ba:" prefix. A real migration would rename them.
 */
export function roleFromBetterAuth(role: string | null | undefined): WorkspaceRole {
  // The plugin stores comma-separated roles; owner and admin both administer the workspace.
  const roles = (role ?? "").split(",").map((r) => r.trim());
  return roles.includes("owner") || roles.includes("admin") ? "admin" : "member";
}

export async function requireBaWorkspaceContext(): Promise<WorkspaceContext> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/spike/sign-in");
  const orgId = session.session.activeOrganizationId;
  if (!orgId) redirect("/spike");

  const db = getDb();
  const [row] = await db
    .select({ role: authSchema.member.role, orgName: authSchema.organization.name, orgSlug: authSchema.organization.slug })
    .from(authSchema.member)
    .innerJoin(authSchema.organization, eq(authSchema.organization.id, authSchema.member.organizationId))
    .where(and(eq(authSchema.member.userId, session.user.id), eq(authSchema.member.organizationId, orgId)))
    .limit(1);
  if (!row) redirect("/spike"); // stale active organization: the user is no longer a member

  // Same idempotent upserts as the Clerk flow (neon-http, no transactions).
  const user = await upsertUser({
    clerkId: `ba:${session.user.id}`,
    email: session.user.email,
    name: session.user.name || null,
    avatarUrl: session.user.image ?? null,
  });
  if (!user) throw new Error("User was deleted");
  const workspace = await upsertWorkspace(
    { clerkOrgId: `ba:${orgId}`, name: row.orgName, slug: `${slugify(row.orgSlug, 40)}-${orgId.slice(-6).toLowerCase()}` },
    { unarchive: true },
  );
  const role = roleFromBetterAuth(row.role);
  await upsertMembership(workspace.id, user.id, role);

  return { userId: user.id, workspaceId: workspace.id, role, timezone: user.timezone, userName: user.name, workspaceName: workspace.name };
}
