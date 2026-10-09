import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { rateLimit } from "@/db/auth-schema";

/**
 * Per-e-mail cap on sign-in codes (COMP-002). Better Auth's own limiter is per IP, so a botnet could keep asking for
 * fresh 6-digit codes for one address. Counters live in `auth_rate_limit` (shared across serverless instances) and are
 * bumped with one atomic upsert, which works on neon-http (no transactions). Keys hold a hash, never the address.
 */
export const OTP_EMAIL_LIMITS = [
  { name: "hour", windowMs: 60 * 60 * 1000, max: 5 },
  { name: "day", windowMs: 24 * 60 * 60 * 1000, max: 20 },
] as const;

const keyFor = (name: string, email: string) => `otp-email:${name}:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`;

/** Registers one code request for `email`. Returns false when any window is over its cap (the request must be refused). */
export async function consumeOtpQuota(db: Db, email: string, now = Date.now()): Promise<boolean> {
  let allowed = true;
  for (const { name, windowMs, max } of OTP_EMAIL_LIMITS) {
    const expired = sql`${now}::bigint - ${rateLimit.lastRequest} >= ${windowMs}`;
    const [row] = await db
      .insert(rateLimit)
      .values({ id: randomUUID(), key: keyFor(name, email), count: 1, lastRequest: now })
      .onConflictDoUpdate({
        target: rateLimit.key,
        set: {
          count: sql`case when ${expired} then 1 else ${rateLimit.count} + 1 end`,
          lastRequest: sql`case when ${expired} then ${now}::bigint else ${rateLimit.lastRequest} end`,
        },
      })
      .returning({ count: rateLimit.count });
    if (row.count > max) allowed = false;
  }
  return allowed;
}
