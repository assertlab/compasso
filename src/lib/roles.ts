export type WorkspaceRole = "admin" | "member";

/** Maps a Clerk organization role (e.g. "org:admin") to a workspace role. Anything unknown is a plain member. */
export function roleFromClerk(orgRole: string | null | undefined): WorkspaceRole {
  return orgRole === "org:admin" ? "admin" : "member";
}
