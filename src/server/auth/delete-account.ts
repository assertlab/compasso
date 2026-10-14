import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { users } from "@/db/schema";
import { consumeQuota, type QuotaWindow } from "@/server/rate-limit";
import { anonymizeAccount, AnonymizeBlockedError, planAnonymization, type AnonymizePlan } from "./anonymize";
import { hashEmail } from "./otp-limit";
import type { Mailer } from "./mail";

/**
 * Immediate account deletion (ADR-037). Two proofs are required: a code mailed to the account's address (an open session
 * alone is not enough: a stolen cookie must not be able to erase a person) and the typed word EXCLUIR. The erasure itself
 * is `anonymizeAccount` (ADR-034).
 *
 * The code lives in `auth_verification` under `delete-account-otp-<email>`: the same `%-otp-<email>` shape the anonymization
 * already sweeps, so a leftover code never outlives the account. Only a hash is stored, with a bounded number of attempts
 * and a short life; asking again replaces the previous code.
 */

export const DELETE_CONFIRMATION_WORD = "EXCLUIR";
export const DELETE_CODE_TTL_MS = 10 * 60 * 1000;
export const DELETE_CODE_MAX_ATTEMPTS = 3;
export const DELETE_CODE_LIMITS: readonly QuotaWindow[] = [
  { name: "hour", windowMs: 60 * 60 * 1000, max: 3 },
  { name: "day", windowMs: 24 * 60 * 60 * 1000, max: 6 },
];

export type DeletionFailure = "rate-limited" | "blocked" | "no-code" | "expired" | "too-many-attempts" | "wrong-code" | "wrong-confirmation" | "not-found";

export type DeletionCodeResult = { ok: true } | { ok: false; reason: "rate-limited"; retryAfterSeconds: number } | { ok: false; reason: "blocked"; workspaces: string[] } | { ok: false; reason: "not-found" };

export type DeletionResult =
  | { ok: true; archived: string[] }
  | { ok: false; reason: Exclude<DeletionFailure, "rate-limited" | "blocked"> }
  | { ok: false; reason: "blocked"; workspaces: string[] };

const identifierFor = (email: string) => `delete-account-otp-${email.trim().toLowerCase()}`;
// The code is short, so the hash is bound to the identifier: the same digits do not hash alike across people.
const hashCode = (identifier: string, code: string) => createHash("sha256").update(`${identifier}:${code}`).digest("hex");
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Account address of a not-yet-erased person, from our own table (never from the client). */
async function accountEmail(db: Db, userId: string) {
  const [row] = await db.select({ email: users.email, deletedAt: users.deletedAt }).from(users).where(eq(users.id, userId));
  return row && !row.deletedAt ? row.email.toLowerCase() : null;
}

/** What deleting would do, for the screen: workspaces archived with the account and workspaces that block it. */
export async function previewDeletion(db: Db, userId: string): Promise<AnonymizePlan> {
  return planAnonymization(db, userId);
}

/** Mails a fresh code. Refuses (before creating anything) when the person is blocked or asked too often. */
export async function requestDeletionCode(db: Db, userId: string, send: Mailer, now = Date.now()): Promise<DeletionCodeResult> {
  const email = await accountEmail(db, userId);
  if (!email) return { ok: false, reason: "not-found" };
  const plan = await planAnonymization(db, userId);
  if (plan.status === "blocked") return { ok: false, reason: "blocked", workspaces: plan.blockedBy.map((w) => w.name) };
  const quota = await consumeQuota(db, "delete-code", hashEmail(email), DELETE_CODE_LIMITS, now);
  if (!quota.allowed) return { ok: false, reason: "rate-limited", retryAfterSeconds: quota.retryAfterSeconds };

  const identifier = identifierFor(email);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.delete(authSchema.verification).where(eq(authSchema.verification.identifier, identifier));
  await db.insert(authSchema.verification).values({
    id: randomUUID(),
    identifier,
    value: JSON.stringify({ hash: hashCode(identifier, code), attempts: 0 }),
    expiresAt: new Date(now + DELETE_CODE_TTL_MS),
  });
  await send({
    to: email,
    subject: "Confirme a exclusão da sua conta no Compasso",
    text: `Seu código para excluir a conta: ${code}\nVálido por 10 minutos.\n\nSe não foi você, ignore este e-mail e não informe o código a ninguém: sem ele, nada é excluído.`,
  });
  return { ok: true };
}

/** Checks both proofs and erases the account. The code is single use: it is burned before the erasure starts. */
export async function confirmDeletion(db: Db, userId: string, input: { code: string; confirmation: string }, now = Date.now()): Promise<DeletionResult> {
  const email = await accountEmail(db, userId);
  if (!email) return { ok: false, reason: "not-found" };
  if (input.confirmation.trim() !== DELETE_CONFIRMATION_WORD) return { ok: false, reason: "wrong-confirmation" };

  const identifier = identifierFor(email);
  const [row] = await db.select().from(authSchema.verification).where(eq(authSchema.verification.identifier, identifier));
  if (!row) return { ok: false, reason: "no-code" };
  if (row.expiresAt.getTime() <= now) {
    await db.delete(authSchema.verification).where(eq(authSchema.verification.id, row.id));
    return { ok: false, reason: "expired" };
  }
  const stored = JSON.parse(row.value) as { hash: string; attempts: number };
  if (stored.attempts >= DELETE_CODE_MAX_ATTEMPTS) {
    await db.delete(authSchema.verification).where(eq(authSchema.verification.id, row.id));
    return { ok: false, reason: "too-many-attempts" };
  }
  // Count the attempt first, in one statement keyed on the attempts we read: two parallel guesses cannot both be "the first".
  const counted = await db
    .update(authSchema.verification)
    .set({ value: JSON.stringify({ ...stored, attempts: stored.attempts + 1 }) })
    .where(and(eq(authSchema.verification.id, row.id), eq(authSchema.verification.value, row.value)))
    .returning({ id: authSchema.verification.id });
  if (counted.length === 0) return { ok: false, reason: "wrong-code" };
  if (!sameHash(hashCode(identifier, input.code.trim()), stored.hash)) return { ok: false, reason: "wrong-code" };

  await db.delete(authSchema.verification).where(eq(authSchema.verification.id, row.id));
  try {
    const result = await anonymizeAccount(db, userId);
    return { ok: true, archived: result.status === "anonymized" ? result.archived : [] };
  } catch (error) {
    if (error instanceof AnonymizeBlockedError) return { ok: false, reason: "blocked", workspaces: error.workspaces };
    throw error;
  }
}
