import { headers } from "next/headers";
import { getAuth } from "@/server/auth/auth";
import { roleFromAuth } from "@/server/auth/workspace-context";

/** Whether the signed-in user is an admin of the active organization. Cosmetic only (menu items): authorization stays in the tenant layer. */
export async function isAdminSession(): Promise<boolean> {
  try {
    const { role } = await getAuth().api.getActiveMemberRole({ headers: await headers() });
    return roleFromAuth(role) === "admin";
  } catch {
    return false; // signed out or no active organization
  }
}
