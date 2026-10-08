import { requireBaWorkspaceContext } from "@/server/ba/context";

/** Criterion (e): proves the Clerk-free context plugs into the same shape `getTenant()` returns. */
export async function getTenant() {
  return requireBaWorkspaceContext();
}
