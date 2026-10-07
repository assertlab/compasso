import { getDb } from "@/db";
import { createTenant } from "./tenant";
import { requireWorkspaceContext } from "./workspace-context";

/**
 * Entry point for pages, route handlers and Server Actions that touch workspace
 * data: resolves the session (redirecting when signed out or without a
 * workspace) and returns the workspace-scoped data layer plus the context.
 */
export async function getTenant() {
  const ctx = await requireWorkspaceContext();
  return { ctx, tenant: createTenant(getDb(), ctx) };
}
