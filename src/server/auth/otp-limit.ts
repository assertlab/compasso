import { createHash } from "node:crypto";
import type { Db } from "@/db";
import { consumeQuota } from "@/server/rate-limit";

/**
 * Per-e-mail cap on sign-in codes (COMP-002). Better Auth's own limiter is per IP, so a botnet could keep asking for
 * fresh 6-digit codes for one address. Counters come from `consumeQuota` (`auth_rate_limit`); keys hold a hash, never the address.
 */
export const OTP_EMAIL_LIMITS = [
  { name: "hour", windowMs: 60 * 60 * 1000, max: 5 },
  { name: "day", windowMs: 24 * 60 * 60 * 1000, max: 20 },
] as const;

/** Stable, non-reversible identifier of an address, for counter keys and logs (never the address itself). */
export const hashEmail = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

/** Registers one code request for `email`. Returns false when any window is over its cap (the request must be refused). */
export async function consumeOtpQuota(db: Db, email: string, now = Date.now()): Promise<boolean> {
  return (await consumeQuota(db, "otp-email", hashEmail(email), OTP_EMAIL_LIMITS, now)).allowed;
}
