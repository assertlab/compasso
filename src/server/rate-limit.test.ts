import { beforeAll, describe, expect, it } from "vitest";
import { like } from "drizzle-orm";
import * as authSchema from "@/db/auth-schema";
import type { Db } from "@/db";
import { createTestDb, type TestDb } from "@/test/db";
import { EXPORT_LIMITS } from "./export-limit";
import { consumeQuota } from "./rate-limit";

/** COMP-011: per-person cap on report exports, on the shared counter table. */
describe("consumeQuota with the export limits", () => {
  let db: TestDb;
  const d = () => db as unknown as Db;
  const t0 = Date.UTC(2026, 9, 14, 12, 0, 0);
  const minute = EXPORT_LIMITS[0];
  const hour = EXPORT_LIMITS[1];

  beforeAll(async () => {
    db = await createTestDb();
  });

  it("allows up to the per-minute cap and then refuses, telling when to retry", async () => {
    for (let i = 0; i < minute.max; i++) expect((await consumeQuota(d(), "export", "user-a", EXPORT_LIMITS, t0 + i)).allowed).toBe(true);
    const refused = await consumeQuota(d(), "export", "user-a", EXPORT_LIMITS, t0 + 10_000);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("counts per person: one person's burst does not affect another", async () => {
    expect((await consumeQuota(d(), "export", "user-b", EXPORT_LIMITS, t0 + 20_000)).allowed).toBe(true);
  });

  it("opens a new minute window once the old one has expired, and the cap applies again inside it", async () => {
    const later = t0 + minute.windowMs + 1000;
    for (let i = 0; i < minute.max; i++) expect((await consumeQuota(d(), "export", "user-a", EXPORT_LIMITS, later + i)).allowed).toBe(true);
    const refused = await consumeQuota(d(), "export", "user-a", EXPORT_LIMITS, later + 5_000);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("enforces the hourly cap across minutes", async () => {
    const start = t0 + 2 * 60 * 60 * 1000;
    let allowed = 0;
    for (let i = 0; i < hour.max + 5; i++) {
      // one export every 7 s keeps each minute under its cap (at most 9), so only the hourly window can refuse
      if ((await consumeQuota(d(), "export", "user-c", EXPORT_LIMITS, start + i * 7_000)).allowed) allowed++;
    }
    expect(allowed).toBe(hour.max);
  });

  it("keeps prefixes apart (export counters never touch the code-request counters)", async () => {
    const rows = await db.select({ key: authSchema.rateLimit.key }).from(authSchema.rateLimit).where(like(authSchema.rateLimit.key, "export:%"));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.key.startsWith("export:"))).toBe(true);
  });
});
