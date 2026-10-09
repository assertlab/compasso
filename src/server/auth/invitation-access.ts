import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { strongestRole } from "./member-roles";

/** Endpoints that return the e-mail address of every pending invitation (COMP-012). */
export const INVITATION_LISTING_PATHS = ["/organization/list-invitations", "/organization/get-full-organization"] as const;

/**
 * Pending invitations expose the e-mail of people who have not joined yet, so only owners and admins may read them.
 * Resolves the organization the way Better Auth does (id, slug, then the session's active one); with none, the endpoint
 * answers on its own. Returns false for a non-member too: the endpoint's own error is not worth leaking either way.
 */
export async function mayListInvitations(
  db: Db,
  { userId, activeOrganizationId, query }: { userId: string; activeOrganizationId?: string | null; query?: { organizationId?: unknown; organizationSlug?: unknown } },
): Promise<boolean> {
  let organizationId: string | null | undefined = typeof query?.organizationId === "string" ? query.organizationId : undefined;
  if (!organizationId && typeof query?.organizationSlug === "string") {
    const [org] = await db.select({ id: authSchema.organization.id }).from(authSchema.organization).where(eq(authSchema.organization.slug, query.organizationSlug));
    organizationId = org?.id;
    if (!organizationId) return true; // unknown slug: the endpoint itself answers "not found"
  }
  organizationId ??= activeOrganizationId;
  if (!organizationId) return true;
  const [row] = await db
    .select({ role: authSchema.member.role })
    .from(authSchema.member)
    .where(and(eq(authSchema.member.userId, userId), eq(authSchema.member.organizationId, organizationId)));
  return !!row && strongestRole(row.role) !== "member";
}
