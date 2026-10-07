import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { timeEntries, workspaceMembers } from "@/db/schema";
import { addMember, createTestDb, seedWorkspace, type TestDb } from "@/test/db";
import { isUniqueViolation } from "./db-errors";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { createTenant, type Tenant } from "./tenant";
import { zonedDayRange } from "@/lib/time";

const TZ = "America/Recife";
const iso = (s: string) => new Date(s);

describe("time entries", () => {
  let db: TestDb;
  let clock = iso("2026-02-27T12:00:00Z");
  const now = () => clock;
  const setNow = (s: string) => (clock = iso(s));

  let a: { workspaceId: string; userId: string };
  let b: { workspaceId: string; userId: string };
  let memberA: { workspaceId: string; userId: string };
  let tA: Tenant; // admin of A
  let tMember: Tenant; // member of A
  let tB: Tenant; // admin of B
  let tAinB: Tenant; // admin of A who is also a member of B
  let projA: { id: string };
  let projA2: { id: string };
  let taskA: { id: string };
  let taskA2: { id: string };
  let tagA: { id: string };
  let projB: { id: string };
  let tagB: { id: string };
  let taskB: { id: string };

  const ctx = (ws: { workspaceId: string; userId: string }, role: "admin" | "member") => ({ ...ws, role, timezone: TZ });
  const make = (ws: { workspaceId: string; userId: string }, role: "admin" | "member") => createTenant(db, ctx(ws, role), { now });

  beforeAll(async () => {
    db = await createTestDb();
    a = await seedWorkspace(db, "a");
    b = await seedWorkspace(db, "b");
    memberA = await addMember(db, a.workspaceId, "ma");
    await db.insert(workspaceMembers).values({ workspaceId: b.workspaceId, userId: a.userId, role: "member" });
    tA = make(a, "admin");
    tMember = make(memberA, "member");
    tB = make(b, "admin");
    tAinB = make({ workspaceId: b.workspaceId, userId: a.userId }, "member");

    const org = await tA.organizations.create({ name: "Cliente" });
    projA = await tA.projects.create({ organizationId: org.id, name: "P1" });
    projA2 = await tA.projects.create({ organizationId: org.id, name: "P2" });
    taskA = await tA.tasks.create({ projectId: projA.id, name: "T1" });
    taskA2 = await tA.tasks.create({ projectId: projA2.id, name: "T2" });
    tagA = await tA.tags.create({ name: "tag" });
    const orgB = await tB.organizations.create({ name: "Cliente" });
    projB = await tB.projects.create({ organizationId: orgB.id, name: "P" });
    taskB = await tB.tasks.create({ projectId: projB.id, name: "T" });
    tagB = await tB.tags.create({ name: "tag" });
  }, 60_000);

  beforeEach(async () => {
    setNow("2026-02-27T12:00:00Z");
    await db.delete(timeEntries); // cascades to tag links
  });

  describe("timer", () => {
    it("starts a timer now with the user's timezone and no project", async () => {
      const e = await tA.timeEntries.startTimer({ description: "estudo" });
      expect(e).toMatchObject({ startedAt: clock, endedAt: null, timezone: TZ, projectId: null, isBillable: true, description: "estudo" });
      expect((await tA.timeEntries.runningTimer()).here?.id).toBe(e.id);
    });

    it("starting a second timer stops the first one at that moment", async () => {
      const first = await tA.timeEntries.startTimer({});
      setNow("2026-02-27T12:30:00Z");
      const second = await tA.timeEntries.startTimer({});
      const [row] = await tA.timeEntries.list({ from: iso("2026-02-27T00:00:00Z"), to: iso("2026-02-28T00:00:00Z") }).then((r) => r.filter((x) => x.id === first.id));
      expect(row.endedAt).toEqual(clock);
      expect((await tA.timeEntries.runningTimer()).here?.id).toBe(second.id);
    });

    it("stops the running timer, and a second stop is not found", async () => {
      await tA.timeEntries.startTimer({});
      setNow("2026-02-27T13:00:00Z");
      const stopped = await tA.timeEntries.stopTimer();
      expect(stopped.endedAt).toEqual(clock);
      await expect(tA.timeEntries.stopTimer()).rejects.toBeInstanceOf(NotFoundError);
    });

    it("never ends an entry at or before its start (stop in the same instant)", async () => {
      const e = await tA.timeEntries.startTimer({});
      const stopped = await tA.timeEntries.stopTimer();
      expect(stopped.endedAt!.getTime()).toBeGreaterThan(e.startedAt.getTime());
    });

    it("blocks a new timer while another runs in a different workspace, and says where", async () => {
      await tA.timeEntries.startTimer({});
      const running = await tAinB.timeEntries.runningTimer();
      expect(running.here).toBeNull();
      expect(running.elsewhere?.workspaceName).toBe("Workspace a");
      await expect(tAinB.timeEntries.startTimer({})).rejects.toBeInstanceOf(ConflictError);
      await expect(tAinB.timeEntries.stopTimer()).rejects.toBeInstanceOf(NotFoundError);
    });

    it("starts again from an entry, copying project, task, tags and billing, and stops the running one", async () => {
      const source = await tA.timeEntries.createManual({
        startedAt: "2026-02-27T09:00:00Z",
        endedAt: "2026-02-27T10:00:00Z",
        description: "revisão",
        projectId: projA.id,
        taskId: taskA.id,
        tagIds: [tagA.id],
        isBillable: false,
      });
      const other = await tA.timeEntries.startTimer({ description: "outra coisa" });
      setNow("2026-02-27T12:30:00Z");
      const again = await tA.timeEntries.startFrom(source.id);
      expect(again).toMatchObject({
        id: expect.not.stringMatching(source.id),
        description: "revisão",
        projectId: projA.id,
        taskId: taskA.id,
        tagIds: [tagA.id],
        isBillable: false,
        startedAt: clock,
        endedAt: null,
      });
      const stopped = (await tA.timeEntries.list({ from: iso("2026-02-27T00:00:00Z"), to: iso("2026-02-28T00:00:00Z") })).find((e) => e.id === other.id);
      expect(stopped?.endedAt).toEqual(clock);
    });

    it("cannot start from someone else's entry, or into an archived project", async () => {
      const theirs = await tMember.timeEntries.createManual({ startedAt: "2026-02-27T09:00:00Z", endedAt: "2026-02-27T10:00:00Z" });
      await expect(tA.timeEntries.startFrom(theirs.id)).rejects.toBeInstanceOf(NotFoundError);
      const mine = await tA.timeEntries.createManual({ startedAt: "2026-02-27T09:00:00Z", endedAt: "2026-02-27T10:00:00Z", projectId: projA.id });
      await tA.projects.update(projA.id, { isArchived: true });
      await expect(tA.timeEntries.startFrom(mine.id)).rejects.toBeInstanceOf(ValidationError);
      await tA.projects.update(projA.id, { isArchived: false });
    });

    it("different users may run timers at the same time", async () => {
      await tA.timeEntries.startTimer({});
      await expect(tMember.timeEntries.startTimer({})).resolves.toBeDefined();
    });

    it("the database itself refuses two running timers for one user", async () => {
      await tA.timeEntries.startTimer({});
      const error = await db
        .insert(timeEntries)
        .values({ workspaceId: a.workspaceId, userId: a.userId, startedAt: clock, timezone: TZ })
        .then(() => null, (e: unknown) => e);
      expect(isUniqueViolation(error)).toBe(true);
    });
  });

  describe("manual entries", () => {
    const base = { startedAt: "2026-02-27T09:00:00Z", endedAt: "2026-02-27T11:00:00Z" };

    it("creates an entry with project, task and tags", async () => {
      const e = await tA.timeEntries.createManual({ ...base, projectId: projA.id, taskId: taskA.id, tagIds: [tagA.id], isBillable: false });
      expect(e).toMatchObject({ projectId: projA.id, taskId: taskA.id, tagIds: [tagA.id], isBillable: false, timezone: TZ });
    });

    it("rejects invalid ranges with field errors", async () => {
      await expect(tA.timeEntries.createManual({ startedAt: base.endedAt, endedAt: base.startedAt })).rejects.toMatchObject({
        fieldErrors: { endedAt: expect.any(String) },
      });
      await expect(
        tA.timeEntries.createManual({ startedAt: "2026-02-25T00:00:00Z", endedAt: "2026-02-27T00:00:00Z" }),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        tA.timeEntries.createManual({ startedAt: "2026-02-27T13:00:00Z", endedAt: "2026-02-27T14:00:00Z" }),
      ).rejects.toMatchObject({ fieldErrors: { startedAt: expect.any(String) } });
    });

    it("rejects malformed input (Zod)", async () => {
      await expect(tA.timeEntries.createManual({ startedAt: "nope", endedAt: base.endedAt })).rejects.toBeInstanceOf(ZodError);
      await expect(tA.timeEntries.createManual({ ...base, description: "x".repeat(501) })).rejects.toBeInstanceOf(ZodError);
    });

    it("ignores a smuggled workspaceId or userId", async () => {
      const e = await tA.timeEntries.createManual({ ...base, workspaceId: b.workspaceId, userId: b.userId } as never);
      expect(e).toMatchObject({ workspaceId: a.workspaceId, userId: a.userId });
    });
  });

  describe("references", () => {
    const base = { startedAt: "2026-02-27T09:00:00Z", endedAt: "2026-02-27T11:00:00Z" };

    it("treats other workspaces' project, task and tag as not found", async () => {
      await expect(tA.timeEntries.createManual({ ...base, projectId: projB.id })).rejects.toBeInstanceOf(NotFoundError);
      await expect(tA.timeEntries.createManual({ ...base, projectId: projA.id, taskId: taskB.id })).rejects.toBeInstanceOf(NotFoundError);
      await expect(tA.timeEntries.createManual({ ...base, tagIds: [tagB.id] })).rejects.toBeInstanceOf(NotFoundError);
      await expect(tA.timeEntries.startTimer({ projectId: projB.id })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("requires the task to belong to the chosen project", async () => {
      await expect(tA.timeEntries.createManual({ ...base, projectId: projA.id, taskId: taskA2.id })).rejects.toBeInstanceOf(ValidationError);
      await expect(tA.timeEntries.createManual({ ...base, taskId: taskA.id })).rejects.toBeInstanceOf(ValidationError);
    });

    it("does not allow assigning an archived project, but keeps an existing assignment", async () => {
      const e = await tA.timeEntries.createManual({ ...base, projectId: projA.id });
      await tA.projects.update(projA.id, { isArchived: true });
      await expect(tA.timeEntries.createManual({ ...base, projectId: projA.id })).rejects.toBeInstanceOf(ValidationError);
      const edited = await tA.timeEntries.update(e.id, { description: "ajuste", projectId: projA.id });
      expect(edited.projectId).toBe(projA.id);
      await tA.projects.update(projA.id, { isArchived: false });
    });
  });

  describe("update", () => {
    const base = { startedAt: "2026-02-27T09:00:00Z", endedAt: "2026-02-27T11:00:00Z" };

    it("edits fields and replaces tags", async () => {
      const e = await tA.timeEntries.createManual({ ...base, tagIds: [tagA.id] });
      const out = await tA.timeEntries.update(e.id, { description: "novo", tagIds: [], isBillable: false });
      expect(out).toMatchObject({ description: "novo", tagIds: [], isBillable: false });
    });

    it("clears the task when the project changes, unless a new task is given", async () => {
      const e = await tA.timeEntries.createManual({ ...base, projectId: projA.id, taskId: taskA.id });
      const moved = await tA.timeEntries.update(e.id, { projectId: projA2.id });
      expect(moved).toMatchObject({ projectId: projA2.id, taskId: null });
      const withTask = await tA.timeEntries.update(e.id, { projectId: projA.id, taskId: taskA.id });
      expect(withTask.taskId).toBe(taskA.id);
    });

    it("revalidates the range only when times are touched", async () => {
      const e = await tA.timeEntries.createManual({ ...base });
      await expect(tA.timeEntries.update(e.id, { endedAt: "2026-02-27T08:00:00Z" })).rejects.toBeInstanceOf(ValidationError);
      await expect(tA.timeEntries.update(e.id, { description: "ok" })).resolves.toBeDefined();
    });

    it("lets only the owner edit: another member, an admin and another workspace get 'not found'", async () => {
      const e = await tMember.timeEntries.createManual({ ...base });
      await expect(tA.timeEntries.update(e.id, { description: "x" })).rejects.toBeInstanceOf(NotFoundError);
      await expect(tA.timeEntries.softDelete(e.id)).rejects.toBeInstanceOf(NotFoundError);
      await expect(tB.timeEntries.update(e.id, { description: "x" })).rejects.toBeInstanceOf(NotFoundError);
      await expect(tMember.timeEntries.update(e.id, { description: "meu" })).resolves.toBeDefined();
    });
  });

  describe("move and resize (calendar drag)", () => {
    const base = { startedAt: "2026-02-27T09:00:00Z", endedAt: "2026-02-27T10:30:00Z" };

    it("moves an entry keeping its exact duration, across days too", async () => {
      const e = await tA.timeEntries.createManual({ startedAt: "2026-02-27T09:00:07Z", endedAt: "2026-02-27T10:30:42Z" });
      const later = await tA.timeEntries.move(e.id, 45);
      expect(later.startedAt).toEqual(iso("2026-02-27T09:45:07Z"));
      expect(later.endedAt).toEqual(iso("2026-02-27T11:15:42Z"));
      const earlier = await tA.timeEntries.move(e.id, -(24 * 60) - 45);
      expect(earlier.startedAt).toEqual(iso("2026-02-26T09:00:07Z"));
    });

    it("refuses moves into the future and keeps the entry unchanged", async () => {
      const e = await tA.timeEntries.createManual(base);
      await expect(tA.timeEntries.move(e.id, 24 * 60)).rejects.toBeInstanceOf(ValidationError);
      const [same] = await tA.timeEntries.list({ from: iso("2026-02-27T00:00:00Z"), to: iso("2026-02-28T00:00:00Z") });
      expect(same.startedAt).toEqual(iso(base.startedAt));
    });

    it("resizes either edge and validates the result", async () => {
      const e = await tA.timeEntries.createManual(base);
      expect((await tA.timeEntries.resize(e.id, "end", iso("2026-02-27T11:00:00Z"))).endedAt).toEqual(iso("2026-02-27T11:00:00Z"));
      expect((await tA.timeEntries.resize(e.id, "start", iso("2026-02-27T08:00:00Z"))).startedAt).toEqual(iso("2026-02-27T08:00:00Z"));
      await expect(tA.timeEntries.resize(e.id, "end", iso("2026-02-27T07:00:00Z"))).rejects.toBeInstanceOf(ValidationError);
      await expect(tA.timeEntries.resize(e.id, "start", iso("2026-02-26T08:00:00Z"))).rejects.toBeInstanceOf(ValidationError); // > 24 h
    });

    it("does not touch running timers, other people's entries or other workspaces", async () => {
      const running = await tA.timeEntries.startTimer({});
      await expect(tA.timeEntries.move(running.id, 15)).rejects.toBeInstanceOf(ValidationError);
      await expect(tA.timeEntries.resize(running.id, "end", clock)).rejects.toBeInstanceOf(ValidationError);
      const theirs = await tMember.timeEntries.createManual(base);
      await expect(tA.timeEntries.move(theirs.id, 15)).rejects.toBeInstanceOf(NotFoundError);
      await expect(tB.timeEntries.resize(theirs.id, "end", iso("2026-02-27T11:00:00Z"))).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("logical deletion", () => {
    const base = { startedAt: "2026-02-27T09:00:00Z", endedAt: "2026-02-27T11:00:00Z" };
    const day = { from: iso("2026-02-27T00:00:00Z"), to: iso("2026-02-28T00:00:00Z") };

    it("hides a deleted entry and brings it back on restore, keeping the row", async () => {
      const e = await tA.timeEntries.createManual({ ...base, tagIds: [tagA.id] });
      await tA.timeEntries.softDelete(e.id);
      expect(await tA.timeEntries.list(day)).toHaveLength(0);
      await expect(tA.timeEntries.update(e.id, { description: "x" })).rejects.toBeInstanceOf(NotFoundError);
      const [raw] = await db.select().from(timeEntries);
      expect(raw.deletedAt).not.toBeNull();
      const back = await tA.timeEntries.restore(e.id);
      expect(back.tagIds).toEqual([tagA.id]);
      expect(await tA.timeEntries.list(day)).toHaveLength(1);
    });

    it("deleting the running timer frees the slot; restoring it while another runs conflicts", async () => {
      const first = await tA.timeEntries.startTimer({});
      await tA.timeEntries.softDelete(first.id);
      expect((await tA.timeEntries.runningTimer()).here).toBeNull();
      await tA.timeEntries.startTimer({});
      await expect(tA.timeEntries.restore(first.id)).rejects.toBeInstanceOf(ConflictError);
    });

    it("cannot restore someone else's entry", async () => {
      const e = await tMember.timeEntries.createManual({ ...base });
      await tMember.timeEntries.softDelete(e.id);
      await expect(tA.timeEntries.restore(e.id)).rejects.toBeInstanceOf(NotFoundError);
      await expect(tB.timeEntries.restore(e.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("list", () => {
    const day = { from: iso("2026-02-27T00:00:00Z"), to: iso("2026-02-28T00:00:00Z") };
    const range = (startedAt: string, endedAt: string) => ({ startedAt, endedAt });

    it("members see only their own hours; asking for others is forbidden", async () => {
      await tA.timeEntries.createManual(range("2026-02-27T09:00:00Z", "2026-02-27T10:00:00Z"));
      const mine = await tMember.timeEntries.createManual(range("2026-02-27T09:00:00Z", "2026-02-27T10:00:00Z"));
      expect((await tMember.timeEntries.list(day)).map((e) => e.id)).toEqual([mine.id]);
      await expect(tMember.timeEntries.list({ ...day, userId: a.userId })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(tMember.timeEntries.list({ ...day, userId: "all" })).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("admins default to their own, and can ask for everyone or one member", async () => {
      const mineA = await tA.timeEntries.createManual(range("2026-02-27T09:00:00Z", "2026-02-27T10:00:00Z"));
      const theirs = await tMember.timeEntries.createManual(range("2026-02-27T09:00:00Z", "2026-02-27T10:00:00Z"));
      expect((await tA.timeEntries.list(day)).map((e) => e.id)).toEqual([mineA.id]);
      expect((await tA.timeEntries.list({ ...day, userId: "all" })).map((e) => e.id).sort()).toEqual([mineA.id, theirs.id].sort());
      expect((await tA.timeEntries.list({ ...day, userId: memberA.userId })).map((e) => e.id)).toEqual([theirs.id]);
    });

    it("never leaks entries across workspaces, not even for a user who belongs to both", async () => {
      await tA.timeEntries.createManual(range("2026-02-27T09:00:00Z", "2026-02-27T10:00:00Z"));
      expect(await tB.timeEntries.list({ ...day, userId: "all" })).toHaveLength(0);
      expect(await tAinB.timeEntries.list(day)).toHaveLength(0);
    });

    it("filters by local day: Recife's day starts at 03:00Z and half-open at the end", async () => {
      const d = zonedDayRange("2026-02-27", TZ);
      const lateNight = await tA.timeEntries.createManual(range("2026-02-27T02:00:00Z", "2026-02-27T02:30:00Z")); // 23:00 on the 26th local
      const first = await tA.timeEntries.createManual(range("2026-02-27T03:00:00Z", "2026-02-27T04:00:00Z"));
      setNow("2026-02-28T12:00:00Z");
      const nextDay = await tA.timeEntries.createManual(range("2026-02-28T03:00:00Z", "2026-02-28T04:00:00Z"));
      const ids = (await tA.timeEntries.list(d)).map((e) => e.id);
      expect(ids).toEqual([first.id]);
      expect(ids).not.toContain(lateNight.id);
      expect(ids).not.toContain(nextDay.id);
    });

    it("includes the running timer, newest first", async () => {
      const old = await tA.timeEntries.createManual(range("2026-02-27T09:00:00Z", "2026-02-27T10:00:00Z"));
      const running = await tA.timeEntries.startTimer({});
      expect((await tA.timeEntries.list(day)).map((e) => e.id)).toEqual([running.id, old.id]);
    });
  });

  describe("description autocomplete", () => {
    it("suggests the caller's recent distinct descriptions by prefix, most recent first, escaping wildcards", async () => {
      const r = (d: string, h: number) =>
        tA.timeEntries.createManual({
          description: d,
          startedAt: `2026-02-27T0${h}:00:00Z`,
          endedAt: `2026-02-27T0${h}:30:00Z`,
        });
      await r("Reunião de alinhamento", 1);
      await r("Revisão de código", 2);
      await r("Reunião de alinhamento", 3);
      await r("100% pronto", 4);
      await r("", 5);
      await tMember.timeEntries.createManual({ description: "Reunião do outro", startedAt: "2026-02-27T06:00:00Z", endedAt: "2026-02-27T06:30:00Z" });

      expect(await tA.timeEntries.recentDescriptions("Re")).toEqual(["Reunião de alinhamento", "Revisão de código"]);
      expect(await tA.timeEntries.recentDescriptions("reu")).toEqual(["Reunião de alinhamento"]);
      expect(await tA.timeEntries.recentDescriptions("%")).toEqual([]);
      expect(await tA.timeEntries.recentDescriptions("")).toHaveLength(3);
    });
  });
});

