import { auth } from "@clerk/nextjs/server";
import { roleFromClerk } from "@/lib/roles";

/** Whether the signed-in user is an admin of the active organization. Cosmetic only (menu items): authorization stays in the tenant layer. */
export async function isAdminSession(): Promise<boolean> {
  const { orgRole } = await auth();
  return roleFromClerk(orgRole) === "admin";
}
