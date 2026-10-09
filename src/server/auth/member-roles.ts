import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { users, workspaces } from "@/db/schema";

export type AuthRole = "owner" | "admin" | "member";

/** The plugin stores comma-separated roles; the strongest one wins. */
export function strongestRole(role: string | null | undefined): AuthRole {
  const roles = (role ?? "").split(",").map((r) => r.trim());
  return roles.includes("owner") ? "owner" : roles.includes("admin") ? "admin" : "member";
}

/**
 * Better Auth roles of the workspace's members, keyed by our `users.id`. Our own role only says admin|member;
 * the owner is the one who cannot be demoted or removed, and the screen needs to know who that is.
 */
export async function authRolesByUser(db: Db, workspaceId: string): Promise<Map<string, AuthRole>> {
  const rows = await db
    .select({ userId: users.id, role: authSchema.member.role })
    .from(workspaces)
    .innerJoin(authSchema.member, eq(authSchema.member.organizationId, workspaces.authOrgId))
    .innerJoin(users, eq(users.authId, authSchema.member.userId))
    .where(eq(workspaces.id, workspaceId));
  return new Map(rows.map((r) => [r.userId, strongestRole(r.role)]));
}
