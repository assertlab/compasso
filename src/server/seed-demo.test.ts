import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { organizations, projects, tags, timeEntries, timeEntryTags } from "@/db/schema";
import { localDateString } from "@/lib/time";
import { createTestDb, seedWorkspace, type TestDb } from "@/test/db";
import { planDay, seedDemo } from "./seed-demo";

const TZ = "America/Recife";
const NOW = new Date("2026-10-09T15:00:00Z");

describe("seedDemo", () => {
  let db: TestDb;
  let a: { workspaceId: string; userId: string };
  let b: { workspaceId: string; userId: string };
  const run = (apply: boolean, who = a) => seedDemo(db as unknown as Db, { ...who, timezone: TZ, today: NOW, apply });

  beforeEach(async () => {
    db = await createTestDb();
    a = await seedWorkspace(db, "sa");
    b = await seedWorkspace(db, "sb");
  });

  it("dry-run reports the plan and writes nothing", async () => {
    const r = await run(false);
    expect(r).toMatchObject({ applied: false, skipped: false, clients: 3, projects: 5 });
    expect(r.entries).toBeGreaterThan(80);
    expect(await db.select().from(organizations)).toHaveLength(0);
    expect(await db.select().from(timeEntries)).toHaveLength(0);
  });

  it("applies: catalog, tagged entries, only weekdays before today, closed and non-overlapping", async () => {
    const r = await run(true);
    expect(r.applied).toBe(true);
    const entries = await db.select().from(timeEntries).where(eq(timeEntries.workspaceId, a.workspaceId));
    expect(entries).toHaveLength(r.entries);
    const today = localDateString(NOW, TZ);
    for (const e of entries) {
      expect(e.endedAt).not.toBeNull();
      expect(e.endedAt! > e.startedAt).toBe(true);
      const day = localDateString(e.startedAt, TZ);
      expect(day < today).toBe(true);
      expect([0, 6]).not.toContain(new Date(`${day}T12:00:00Z`).getUTCDay());
    }
    const sorted = [...entries].sort((x, y) => x.startedAt.getTime() - y.startedAt.getTime());
    sorted.slice(1).forEach((e, i) => expect(e.startedAt >= sorted[i].endedAt!).toBe(true));
    expect(entries.some((e) => e.projectId === null)).toBe(true); // exercises the "without project" warning
    expect(entries.some((e) => !e.isBillable)).toBe(true);
    const demo = await db.select().from(tags).where(and(eq(tags.workspaceId, a.workspaceId), eq(tags.name, "demo")));
    const tagged = await db.select().from(timeEntryTags).where(eq(timeEntryTags.tagId, demo[0].id));
    expect(tagged).toHaveLength(r.entries);
  });

  it("is idempotent and stays inside the target workspace", async () => {
    await run(true);
    const again = await run(true);
    expect(again.skipped).toBe(true);
    expect(await db.select().from(timeEntries).where(eq(timeEntries.workspaceId, a.workspaceId))).toHaveLength((await run(false)).entries);
    expect(await db.select().from(projects).where(eq(projects.workspaceId, b.workspaceId))).toHaveLength(0);
    expect(await db.select().from(timeEntries).where(eq(timeEntries.workspaceId, b.workspaceId))).toHaveLength(0);
  });

  it("can seed a second workspace independently (same client names)", async () => {
    await run(true);
    expect((await run(true, b)).applied).toBe(true);
    expect(await db.select().from(organizations)).toHaveLength(6);
  });

  it("recovers from a run that died before the marker tag, without duplicating entries", async () => {
    const full = await run(true);
    await db.delete(tags).where(and(eq(tags.workspaceId, a.workspaceId), eq(tags.name, "demo"))); // simulate the interrupted run
    await run(true);
    expect(await db.select().from(timeEntries).where(eq(timeEntries.workspaceId, a.workspaceId))).toHaveLength(full.entries);
  });
});

describe("planDay", () => {
  it("never overlaps, skips lunch and ends before 19:00", () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 200; i++) {
      const slots = planDay("2026-10-05", rand);
      expect(slots.length).toBeGreaterThanOrEqual(1);
      slots.forEach((s, j) => {
        expect(s.endMin).toBeGreaterThan(s.startMin);
        expect(s.endMin).toBeLessThanOrEqual(19 * 60);
        expect(s.startMin < 12 * 60 && s.endMin > 12 * 60).toBe(false);
        if (j > 0) expect(s.startMin).toBeGreaterThanOrEqual(slots[j - 1].endMin);
      });
    }
  });
});
