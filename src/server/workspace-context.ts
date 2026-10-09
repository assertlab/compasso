import type { WorkspaceRole } from "@/lib/roles";
import { requireAuthWorkspaceContext } from "@/server/auth/workspace-context";

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
 * Resolves the signed-in person and their active organization (Better Auth, ADR-033) into our own
 * user/workspace/membership rows, creating them on first access. See src/server/auth/workspace-context.ts.
 */
export const requireWorkspaceContext: () => Promise<WorkspaceContext> = requireAuthWorkspaceContext;
