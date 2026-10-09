import { getDb } from "@/db";
import { authRolesByUser } from "./auth/member-roles";

/** Better Auth roles of a workspace's members. Lives under src/server so pages never import the database directly. */
export const workspaceAuthRoles = (workspaceId: string) => authRolesByUser(getDb(), workspaceId);
