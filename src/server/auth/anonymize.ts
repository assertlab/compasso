import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { users, workspaceMembers, workspaces } from "@/db/schema";

/**
 * LGPD erasure of one person (ADR-034). Domain rows are never deleted (ADR-025): memberships are marked removed, the
 * `users` row is anonymized and kept so historical entries stay attributable to "Usuário removido". Identity data
 * (`auth_*`) is physically deleted. neon-http has no interactive transactions, so this is an ordered sequence of
 * idempotent statements: a failed run is finished by running it again.
 */

export type AnonymizePlan =
  | { status: "already-anonymized" }
  | {
      status: "ready" | "blocked";
      userId: string;
      /** Workspaces where this person is the only active member: archived along with the account. */
      archive: { id: string; name: string }[];
      /** Workspaces where this person is the only active admin and other members would be left without one. */
      blockedBy: { id: string; name: string }[];
      memberships: number;
    };

export class AnonymizeBlockedError extends Error {
  constructor(readonly workspaces: string[]) {
    super(`Cannot anonymize: the only admin of ${workspaces.map((w) => `"${w}"`).join(", ")}. Promote another admin first.`);
    this.name = "AnonymizeBlockedError";
  }
}

export const anonymizedEmail = (userId: string) => `deleted-${userId}@anonymized.invalid`;

export async function planAnonymization(db: Db, userId: string): Promise<AnonymizePlan> {
  const [user] = await db.select({ deletedAt: users.deletedAt }).from(users).where(eq(users.id, userId));
  if (!user) throw new Error(`User ${userId} not found`);
  if (user.deletedAt) return { status: "already-anonymized" };

  const mine = await db
    .select({ workspaceId: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(workspaceMembers.userId, userId), isNull(workspaceMembers.removedAt), isNull(workspaces.archivedAt)));

  const archive: { id: string; name: string }[] = [];
  const blockedBy: { id: string; name: string }[] = [];
  for (const m of mine) {
    const others = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, m.workspaceId), isNull(workspaceMembers.removedAt), ne(workspaceMembers.userId, userId)));
    if (others.length === 0) archive.push({ id: m.workspaceId, name: m.name });
    else if (m.role === "admin" && !others.some((o) => o.role === "admin")) blockedBy.push({ id: m.workspaceId, name: m.name });
  }
  return { status: blockedBy.length ? "blocked" : "ready", userId, archive, blockedBy, memberships: mine.length };
}

export async function anonymizeAccount(db: Db, userId: string) {
  const plan = await planAnonymization(db, userId);
  if (plan.status === "already-anonymized") return plan;
  if (plan.status === "blocked") throw new AnonymizeBlockedError(plan.blockedBy.map((w) => w.name));

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const now = new Date();

  // 1. Workspaces nobody else uses are archived (data kept, access blocked).
  for (const w of plan.archive) {
    await db.update(workspaces).set({ archivedAt: now, updatedAt: now }).where(and(eq(workspaces.id, w.id), isNull(workspaces.archivedAt)));
  }
  // 2. Access first: from here on the person is locked out even if a later step fails.
  await db
    .update(workspaceMembers)
    .set({ removedAt: now, updatedAt: now })
    .where(and(eq(workspaceMembers.userId, userId), isNull(workspaceMembers.removedAt)));
  // 3. Identity data. Everything in auth_* hangs off auth_user by cascade (sessions, accounts, members, invitations
  //    they sent); pending invitations *to* their e-mail and unused OTPs are keyed by e-mail instead.
  const email = user.email.toLowerCase();
  await db.delete(authSchema.invitation).where(sql`lower(${authSchema.invitation.email}) = ${email}`);
  // OTP identifiers look like "sign-in-otp-<email>" ("_" in the e-mail is a LIKE wildcard: it can only over-match expired codes).
  await db
    .delete(authSchema.verification)
    .where(or(sql`lower(${authSchema.verification.identifier}) = ${email}`, sql`lower(${authSchema.verification.identifier}) like ${"%-otp-" + email}`));
  await db
    .delete(authSchema.user)
    .where(user.authId ? or(eq(authSchema.user.id, user.authId), sql`lower(${authSchema.user.email}) = ${email}`) : sql`lower(${authSchema.user.email}) = ${email}`);
  // 4. Last: the domain row. Until this lands the person is not marked deleted, so a rerun redoes steps 1-3 harmlessly.
  //    `auth_id` stays as an opaque dangling key; the e-mail is gone, so a new sign-up with it is a new person.
  await db
    .update(users)
    .set({ email: anonymizedEmail(userId), name: null, avatarUrl: null, clerkId: null, deletedAt: now, updatedAt: now })
    .where(eq(users.id, userId));

  return { status: "anonymized" as const, userId, archived: plan.archive.map((w) => w.name), memberships: plan.memberships };
}
