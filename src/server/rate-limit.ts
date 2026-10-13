import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { rateLimit } from "@/db/auth-schema";

export type QuotaWindow = { name: string; windowMs: number; max: number };
export type QuotaResult = { allowed: boolean; retryAfterSeconds: number };

/**
 * Fixed-window counters in `auth_rate_limit` (shared by every serverless instance, unlike memory). Each window is bumped
 * with one atomic upsert, which works on neon-http (no interactive transactions). Requests are counted whether or not they
 * are refused. `key` must already be safe to store (a hash or an opaque id, never an e-mail address).
 */
export async function consumeQuota(db: Db, prefix: string, key: string, windows: readonly QuotaWindow[], now = Date.now()): Promise<QuotaResult> {
  let retryAfterMs = 0;
  for (const { name, windowMs, max } of windows) {
    const expired = sql`${now}::bigint - ${rateLimit.lastRequest} >= ${windowMs}`;
    const [row] = await db
      .insert(rateLimit)
      .values({ id: randomUUID(), key: `${prefix}:${name}:${key}`, count: 1, lastRequest: now })
      .onConflictDoUpdate({
        target: rateLimit.key,
        set: {
          count: sql`case when ${expired} then 1 else ${rateLimit.count} + 1 end`,
          lastRequest: sql`case when ${expired} then ${now}::bigint else ${rateLimit.lastRequest} end`,
        },
      })
      .returning({ count: rateLimit.count, lastRequest: rateLimit.lastRequest });
    if (row.count > max) retryAfterMs = Math.max(retryAfterMs, Number(row.lastRequest) + windowMs - now);
  }
  return { allowed: retryAfterMs === 0, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
}
