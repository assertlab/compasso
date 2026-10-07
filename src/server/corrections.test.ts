import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { timeEntries, timeEntryAudit } from "@/db/schema";
import { addMember, createTestDb, seedWorkspace, type TestDb } from "@/test/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { createTenant, type Tenant } from "./tenant";

const TZ = "America/Recife";
type Who = { workspaceId: string; userId: string };

describe("admin corrections with audit trail", () => {
  let db: TestDb;
  let boss: Who;
  let helper: Who; // second admin
  let ana: Who;
  let bia: Who;
  let other: Who;
  let tBoss: Tenant;
  let tHelper: Tenant;
  let tAna: Tenant;
  let tBia: Tenant;
  let tOther: Tenant;
  let p1: { id: string };
  let p2: { id: string };
  let t1: { id: string };
  let tagId: string;
  let clock = new Date("2026-02-27T12:00:00Z");

  const make = (u: Who, role: "admin" | "member") => createTenant(db, { ...u, role, timezone: TZ }, { now: () => clock });
  const range = (extra: object = {}) => ({ startedAt: "2026-02-27T09:00:00Z", endedAt: "2026-02-27T10:00:00Z", ...extra });

  beforeAll(async () => {
    db = await createTestDb();
    boss = await seedWorkspace(db, "ca");
    other = await seedWorkspace(db, "cb");
    helper = await addMember(db, boss.workspaceId, "chelper", "admin");
    ana = await addMember(db, boss.workspaceId, "cana");
    bia = await addMember(db, boss.workspaceId, "cbia");
    tBoss = make(boss, "admin");
    tHelper = make(helper, "admin");
    tAna = make(ana, "member");
    tBia = make(bia, "member");
    tOther = make(other, "admin");
    const org = await tBoss.organizations.create({ name: "Cliente" });
    p1 = await tBoss.projects.create({ organizationId: org.id, name: "P1" });
    p2 = await tBoss.projects.create({ organizationId: org.id, name: "P2" });
    t1 = await tBoss.tasks.create({ projectId: p2.id, name: "T" });
    tagId = (await tBoss.tags.create({ name: "tag" })).id;
    await tBoss.projectMembers.add(p1.id, ana.userId);
  }, 60_000);

  beforeEach(async () => {
    clock = new Date("2026-02-27T12:00:00Z");
    await db.delete(timeEntries); // cascades to the audit trail and tag links
  });

  const audits = (entryId: string) => db.select().from(timeEntryAudit).where(eq(timeEntryAudit.timeEntryId, entryId));

  describe("update", () => {
    it("changes another member's entry and records who changed what", async () => {
      const e = await tAna.timeEntries.createManual(range({ projectId: p1.id, description: "antes" }));
      const fixed = await tBoss.timeEntries.correct.update(e.id, { description: "depois", projectId: p2.id, taskId: t1.id, endedAt: new Date("2026-02-27T10:30:00Z") });
      expect(fixed).toMatchObject({ description: "depois", projectId: p2.id, taskId: t1.id, userId: ana.userId });

      const [log] = await audits(e.id);
      expect(log).toMatchObject({ action: "update", actorUserId: boss.userId, workspaceId: boss.workspaceId });
      expect(log.changes).toEqual({
        description: { from: "antes", to: "depois" },
        projectId: { from: p1.id, to: p2.id },
        taskId: { from: null, to: t1.id },
        endedAt: { from: "2026-02-27T10:00:00.000Z", to: "2026-02-27T10:30:00.000Z" },
      });
    });

    it("lets the admin use a project the member is not part of (admin authority)", async () => {
      const e = await tBia.timeEntries.createManual(range());
      await expect(tBoss.timeEntries.correct.update(e.id, { projectId: p1.id })).resolves.toMatchObject({ projectId: p1.id });
    });

    it("records tag and billing changes, and skips the trail when nothing changed", async () => {
      const e = await tAna.timeEntries.createManual(range({ description: "x" }));
      await tBoss.timeEntries.correct.update(e.id, { tagIds: [tagId], isBillable: false });
      expect((await audits(e.id))[0].changes).toEqual({ isBillable: { from: true, to: false }, tagIds: { from: [], to: [tagId] } });
      await tBoss.timeEntries.correct.update(e.id, { description: "x", tagIds: [tagId], isBillable: false });
      expect(await audits(e.id)).toHaveLength(1);
    });

    it("keeps the same validations as a normal edit", async () => {
      const e = await tAna.timeEntries.createManual(range());
      await expect(tBoss.timeEntries.correct.update(e.id, { endedAt: new Date("2026-02-27T08:00:00Z") })).rejects.toBeInstanceOf(ValidationError);
      await expect(tBoss.timeEntries.correct.update(e.id, { startedAt: new Date("2026-03-05T09:00:00Z"), endedAt: new Date("2026-03-05T10:00:00Z") })).rejects.toBeInstanceOf(ValidationError);
      await expect(tBoss.timeEntries.correct.update(e.id, { taskId: t1.id, projectId: p1.id })).rejects.toBeInstanceOf(ValidationError);
      expect(await audits(e.id)).toHaveLength(0); // a rejected correction leaves no trail
    });

    it("refuses to touch someone else's running timer", async () => {
      const running = await tAna.timeEntries.startTimer({});
      await expect(tBoss.timeEntries.correct.update(running.id, { description: "x" })).rejects.toBeInstanceOf(ValidationError);
      await expect(tBoss.timeEntries.correct.softDelete(running.id)).rejects.toBeInstanceOf(ValidationError);
    });

    it("on the admin's own entry behaves like a normal edit, with no trail", async () => {
      const mine = await tBoss.timeEntries.createManual(range({ description: "meu" }));
      await tBoss.timeEntries.correct.update(mine.id, { description: "meu 2" });
      expect(await audits(mine.id)).toHaveLength(0);
    });

    it("can be done by any admin, and the trail names the actor", async () => {
      const e = await tAna.timeEntries.createManual(range());
      await tHelper.timeEntries.correct.update(e.id, { description: "ajuste" });
      const history = await tBoss.timeEntries.correct.history(e.id);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ action: "update", actor: "User chelper" });
    });
  });

  describe("delete and restore", () => {
    it("removes and restores another member's entry, each time with a trail", async () => {
      const e = await tAna.timeEntries.createManual(range());
      await tBoss.timeEntries.correct.softDelete(e.id);
      expect(await tAna.timeEntries.list({ from: new Date("2026-02-27T00:00:00Z"), to: new Date("2026-02-28T00:00:00Z") })).toHaveLength(0);
      await tBoss.timeEntries.correct.restore(e.id);
      expect(await tAna.timeEntries.list({ from: new Date("2026-02-27T00:00:00Z"), to: new Date("2026-02-28T00:00:00Z") })).toHaveLength(1);
      const trail = await audits(e.id);
      expect(trail.map((t) => t.action).sort()).toEqual(["delete", "restore"]);
      expect(trail.find((t) => t.action === "delete")?.changes).toEqual({ deletedAt: { from: null, to: "2026-02-27T12:00:00.000Z" } });
    });

    it("cannot restore when the person has started another timer since", async () => {
      const running = await tAna.timeEntries.startTimer({});
      await tAna.timeEntries.stopTimer();
      const open = await tAna.timeEntries.startTimer({});
      // Only finished entries can be deleted by an admin, so craft the deleted-running case directly.
      await db.update(timeEntries).set({ endedAt: null, deletedAt: new Date() }).where(eq(timeEntries.id, running.id));
      await expect(tBoss.timeEntries.correct.restore(running.id)).rejects.toBeInstanceOf(ConflictError);
      expect(await audits(running.id)).toHaveLength(0); // compensated: no trail for a change that did not happen
      expect(open.id).toBeDefined();
    });
  });

  describe("who may do it", () => {
    it("members cannot correct anything, not even their own through this door", async () => {
      const e = await tAna.timeEntries.createManual(range());
      await expect(tAna.timeEntries.correct.update(e.id, { description: "x" })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(tAna.timeEntries.correct.softDelete(e.id)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(tAna.timeEntries.correct.restore(e.id)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(tAna.timeEntries.correct.history(e.id)).rejects.toBeInstanceOf(ForbiddenError);
      // ...and the normal methods still refuse other people's entries.
      const theirs = await tBia.timeEntries.createManual(range());
      await expect(tAna.timeEntries.update(theirs.id, { description: "x" })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("never reaches another workspace", async () => {
      const e = await tAna.timeEntries.createManual(range());
      await expect(tOther.timeEntries.correct.update(e.id, { description: "x" })).rejects.toBeInstanceOf(NotFoundError);
      await expect(tOther.timeEntries.correct.softDelete(e.id)).rejects.toBeInstanceOf(NotFoundError);
      expect(await tOther.timeEntries.correct.history(e.id)).toEqual([]);
    });
  });

  it("the report flags corrected entries to everyone who sees them", async () => {
    const e = await tAna.timeEntries.createManual(range());
    const from = new Date("2026-02-27T00:00:00Z");
    const to = new Date("2026-02-28T00:00:00Z");
    expect((await tAna.reports.run({ from, to })).rows[0].corrected).toBe(false);
    await tBoss.timeEntries.correct.update(e.id, { description: "corrigido" });
    expect((await tAna.reports.run({ from, to })).rows[0].corrected).toBe(true);
    expect((await tBoss.reports.run({ from, to })).rows[0].corrected).toBe(true);
  });
});
