import { and, eq, gt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { allowedEmails } from "@/db/schema";

/**
 * Closed-beta gate (ADR-038). In "closed" mode an e-mail may create an account only if it is on the allow list or has a
 * pending invitation (a workspace admin vouches for people they invite). People who already have an account always pass:
 * the gate is about new accounts, not about signing in.
 */

export type AccessMode = "open" | "closed";

const normalize = (email: string) => email.trim().toLowerCase();

export async function mayCreateAccount(db: Db, mode: AccessMode, email: string, now = new Date()): Promise<boolean> {
  if (mode === "open") return true;
  const e = normalize(email);

  const [existing] = await db.select({ id: authSchema.user.id }).from(authSchema.user).where(sql`lower(${authSchema.user.email}) = ${e}`).limit(1);
  if (existing) return true;

  const [listed] = await db.select({ id: allowedEmails.id }).from(allowedEmails).where(eq(allowedEmails.email, e)).limit(1);
  if (listed) return true;

  const [invited] = await db
    .select({ id: authSchema.invitation.id })
    .from(authSchema.invitation)
    .where(and(sql`lower(${authSchema.invitation.email}) = ${e}`, eq(authSchema.invitation.status, "pending"), gt(authSchema.invitation.expiresAt, now)))
    .limit(1);
  return Boolean(invited);
}

export async function allowEmail(db: Db, email: string, note?: string) {
  const e = normalize(email);
  await db.insert(allowedEmails).values({ email: e, note: note?.trim() || null }).onConflictDoNothing({ target: allowedEmails.email });
  return e;
}

export async function disallowEmail(db: Db, email: string): Promise<boolean> {
  const removed = await db.delete(allowedEmails).where(eq(allowedEmails.email, normalize(email))).returning({ id: allowedEmails.id });
  return removed.length > 0;
}

export const listAllowedEmails = (db: Db) => db.select({ email: allowedEmails.email, note: allowedEmails.note, createdAt: allowedEmails.createdAt }).from(allowedEmails).orderBy(allowedEmails.createdAt);
