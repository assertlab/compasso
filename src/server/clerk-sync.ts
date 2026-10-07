import { clerkClient } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { users, workspaceMembers, workspaces } from "@/db/schema";
import { anonymizedUser, userFromClerk, type UserData, type WorkspaceData } from "@/lib/clerk-mappers";
import type { WorkspaceRole } from "@/lib/roles";

/**
 * Idempotent writes shared by lazy provisioning and the Clerk webhook.
 * Clerk is the source of truth for identity/membership; these only mirror it.
 * Deletions are always logical (see ADR-025). neon-http has no interactive
 * transactions, so every function is a single statement or a safe sequence.
 */

export async function upsertUser(data: UserData) {
  const now = new Date();
  const [row] = await getDb()
    .insert(users)
    .values(data)
    .onConflictDoUpdate({
      target: users.clerkId,
      set: { email: data.email, name: data.name, avatarUrl: data.avatarUrl, updatedAt: now },
    })
    .returning();
  return row;
}

export async function upsertWorkspace(data: WorkspaceData) {
  const [row] = await getDb()
    .insert(workspaces)
    .values(data)
    // Slug is set once on insert and never changes. Clerk still has the org, so it is not archived.
    .onConflictDoUpdate({
      target: workspaces.clerkOrgId,
      set: { name: data.name, archivedAt: null, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function upsertMembership(workspaceId: string, userId: string, role: WorkspaceRole) {
  await getDb()
    .insert(workspaceMembers)
    .values({ workspaceId, userId, role })
    .onConflictDoUpdate({
      target: [workspaceMembers.workspaceId, workspaceMembers.userId],
      set: { role, removedAt: null, updatedAt: new Date() },
    });
}

/** Logical removal: the member loses access, their entries stay. */
export async function removeMembership(clerkOrgId: string, clerkUserId: string) {
  const db = getDb();
  const [ws] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.clerkOrgId, clerkOrgId));
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkUserId));
  if (!ws || !user) return; // never mirrored, nothing to remove
  const now = new Date();
  await db
    .update(workspaceMembers)
    .set({ removedAt: now, updatedAt: now })
    .where(
      and(
        eq(workspaceMembers.workspaceId, ws.id),
        eq(workspaceMembers.userId, user.id),
        isNull(workspaceMembers.removedAt),
      ),
    );
}

/** Clerk user deleted: drop access everywhere and strip personal data, keeping the row for history. */
export async function anonymizeUser(clerkUserId: string) {
  const db = getDb();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkUserId));
  if (!user) return;
  const now = new Date();
  // Memberships first: if the second statement fails and Clerk retries, the user is already locked out.
  await db
    .update(workspaceMembers)
    .set({ removedAt: now, updatedAt: now })
    .where(and(eq(workspaceMembers.userId, user.id), isNull(workspaceMembers.removedAt)));
  await db
    .update(users)
    .set({ ...anonymizedUser(user.id), deletedAt: now, updatedAt: now })
    .where(eq(users.id, user.id));
}

/** Clerk organization deleted: keep every record, block access. */
export async function archiveWorkspace(clerkOrgId: string) {
  const now = new Date();
  await getDb()
    .update(workspaces)
    .set({ archivedAt: now, updatedAt: now })
    .where(and(eq(workspaces.clerkOrgId, clerkOrgId), isNull(workspaces.archivedAt)));
}

/**
 * Webhook events can arrive out of order (a membership event before its
 * user.created), so a missing user is fetched from the Clerk API.
 */
export async function ensureUser(clerkUserId: string) {
  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));
  if (existing) return existing;
  const clerkUser = await (await clerkClient()).users.getUser(clerkUserId);
  const data = userFromClerk({
    id: clerkUser.id,
    first_name: clerkUser.firstName,
    last_name: clerkUser.lastName,
    image_url: clerkUser.imageUrl,
    primary_email_address_id: clerkUser.primaryEmailAddressId,
    email_addresses: clerkUser.emailAddresses.map((e) => ({ id: e.id, email_address: e.emailAddress })),
  });
  if (!data) throw new Error(`Clerk user ${clerkUserId} has no email address`);
  return upsertUser(data);
}
