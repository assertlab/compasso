import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { users, workspaceMembers, workspaces } from "@/db/schema";

export type MigrationReport = {
  apply: boolean;
  users: { toCreate: number; created: number; linked: number };
  workspaces: { toCreate: number; created: number; linked: number };
  members: { toCreate: number; created: number; owners: number; admins: number; members: number };
  /** Active members whose user or workspace still has no Better Auth link after the run. Must be 0. */
  orphans: number;
};

/**
 * One-off, idempotent copy of people, workspaces and memberships from our own tables (which already mirror Clerk)
 * into the Better Auth tables (ADR-033). No passwords exist (sign-in is by code/social), sessions are not migrated
 * and pending Clerk invitations must be re-sent. Deleted users, archived workspaces and removed members are skipped.
 * Without `apply` it only counts (dry-run). Rerunning after a partial failure reuses what already exists.
 */
export async function migrateClerkToAuth(db: Db, { apply }: { apply: boolean }): Promise<MigrationReport> {
  const report: MigrationReport = {
    apply,
    users: { toCreate: 0, created: 0, linked: 0 },
    workspaces: { toCreate: 0, created: 0, linked: 0 },
    members: { toCreate: 0, created: 0, owners: 0, admins: 0, members: 0 },
    orphans: 0,
  };
  const now = new Date();

  // 1. people
  const pendingUsers = await db.select().from(users).where(and(isNull(users.authId), isNull(users.deletedAt)));
  for (const u of pendingUsers) {
    const email = u.email.trim().toLowerCase();
    const [existing] = await db.select({ id: authSchema.user.id }).from(authSchema.user).where(eq(authSchema.user.email, email));
    if (!apply) {
      if (existing) report.users.linked++;
      else report.users.toCreate++;
      continue;
    }
    let authId = existing?.id;
    if (authId) report.users.linked++;
    else {
      authId = randomUUID();
      await db.insert(authSchema.user).values({
        id: authId,
        email,
        emailVerified: true, // Clerk verified every address before our mirror existed
        name: u.name?.trim() || email.split("@")[0],
        image: u.avatarUrl,
        createdAt: u.createdAt,
        updatedAt: now,
      });
      report.users.created++;
    }
    await db.update(users).set({ authId, updatedAt: now }).where(eq(users.id, u.id));
  }

  // 2. workspaces
  const pendingWorkspaces = await db.select().from(workspaces).where(and(isNull(workspaces.authOrgId), isNull(workspaces.archivedAt)));
  for (const w of pendingWorkspaces) {
    const [existing] = await db.select({ id: authSchema.organization.id }).from(authSchema.organization).where(eq(authSchema.organization.slug, w.slug));
    if (!apply) {
      if (existing) report.workspaces.linked++;
      else report.workspaces.toCreate++;
      continue;
    }
    let orgId = existing?.id;
    if (orgId) report.workspaces.linked++;
    else {
      orgId = randomUUID();
      await db.insert(authSchema.organization).values({ id: orgId, name: w.name, slug: w.slug, createdAt: w.createdAt });
      report.workspaces.created++;
    }
    await db.update(workspaces).set({ authOrgId: orgId, updatedAt: now }).where(eq(workspaces.id, w.id));
  }

  // 3. memberships: the earliest admin of each workspace is the owner, other admins stay admins
  const wsRows = await db.select().from(workspaces).where(isNull(workspaces.archivedAt));
  for (const w of wsRows) {
    const members = await db
      .select({ userId: users.id, authId: users.authId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(and(eq(workspaceMembers.workspaceId, w.id), isNull(workspaceMembers.removedAt), isNull(users.deletedAt)))
      .orderBy(asc(workspaceMembers.createdAt));
    // In a dry-run nothing is linked yet, so every eligible membership counts as to-create.
    const present = w.authOrgId ? await db.select().from(authSchema.member).where(eq(authSchema.member.organizationId, w.authOrgId)) : [];
    const hasOwner = present.some((m) => m.role === "owner");
    let ownerAssigned = hasOwner;
    for (const m of members) {
      if (m.authId && present.some((p) => p.userId === m.authId)) continue;
      let role: "owner" | "admin" | "member" = m.role === "admin" ? "admin" : "member";
      if (role === "admin" && !ownerAssigned) {
        role = "owner";
        ownerAssigned = true;
      }
      if (!apply) {
        report.members.toCreate++;
        continue;
      }
      await db.insert(authSchema.member).values({ id: randomUUID(), organizationId: w.authOrgId!, userId: m.authId!, role, createdAt: now });
      report.members.created++;
      if (role === "owner") report.members.owners++;
      else if (role === "admin") report.members.admins++;
      else report.members.members++;
    }
  }

  // 4. orphan check (always meaningful on apply; on dry-run it shows what is still unlinked)
  const [orphan] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(isNull(workspaceMembers.removedAt), isNull(users.deletedAt), isNull(workspaces.archivedAt), sql`(${users.authId} is null or ${workspaces.authOrgId} is null)`));
  report.orphans = orphan.n;
  return report;
}
