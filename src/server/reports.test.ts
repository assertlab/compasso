import { beforeAll, describe, expect, it } from "vitest";
import { timeEntries, users, workspaceMembers } from "@/db/schema";
import { addMember, createTestDb, seedWorkspace, type TestDb } from "@/test/db";
import { eq } from "drizzle-orm";
import { ForbiddenError } from "./errors";
import { createTenant, type Tenant } from "./tenant";

const TZ = "America/Recife";
const d = (s: string) => new Date(s);
const FROM = d("2026-02-01T03:00:00Z");
const TO = d("2026-03-01T03:00:00Z");

describe("reports", () => {
  let db: TestDb;
  let admin: { workspaceId: string; userId: string };
  let ana: { workspaceId: string; userId: string };
  let bia: { workspaceId: string; userId: string };
  let other: { workspaceId: string; userId: string };
  let tAdmin: Tenant;
  let tAna: Tenant;
  let tOther: Tenant;
  let c1: { id: string };
  let c2: { id: string };
  let p1: { id: string };
  let p2: { id: string };
  let t1: { id: string };

  const make = (u: { workspaceId: string; userId: string }, role: "admin" | "member") => createTenant(db, { ...u, role, timezone: TZ });
  async function entry(
    u: { workspaceId: string; userId: string },
    start: string,
    end: string | null,
    refs: { projectId?: string; taskId?: string; deleted?: boolean } = {},
  ) {
    await db.insert(timeEntries).values({
      workspaceId: u.workspaceId,
      userId: u.userId,
      projectId: refs.projectId ?? null,
      taskId: refs.taskId ?? null,
      description: "",
      startedAt: d(start),
      endedAt: end ? d(end) : null,
      timezone: TZ,
      deletedAt: refs.deleted ? d("2026-02-20T00:00:00Z") : null,
    });
  }

  beforeAll(async () => {
    db = await createTestDb();
    admin = await seedWorkspace(db, "ra");
    other = await seedWorkspace(db, "rb");
    ana = await addMember(db, admin.workspaceId, "rana");
    bia = await addMember(db, admin.workspaceId, "rbia");
    tAdmin = make(admin, "admin");
    tAna = make(ana, "member");
    tOther = make(other, "admin");

    c1 = await tAdmin.organizations.create({ name: "3 Corações" });
    c2 = await tAdmin.organizations.create({ name: "BNB" });
    p1 = await tAdmin.projects.create({ organizationId: c1.id, name: "Arquitetura" });
    p2 = await tAdmin.projects.create({ organizationId: c2.id, name: "Portal" });
    t1 = await tAdmin.tasks.create({ projectId: p1.id, name: "Revisão" });

    await entry(ana, "2026-02-02T12:00:00Z", "2026-02-02T13:00:00Z", { projectId: p1.id, taskId: t1.id }); // 1h
    await entry(ana, "2026-02-03T12:00:00Z", "2026-02-03T12:30:00Z", { projectId: p2.id }); // 30m
    await entry(ana, "2026-02-04T12:00:00Z", "2026-02-04T12:00:17Z"); // 17s, no project
    await entry(bia, "2026-02-05T12:00:00Z", "2026-02-05T14:00:00Z", { projectId: p1.id }); // 2h
    await entry(admin, "2026-02-06T12:00:00Z", "2026-02-06T12:10:00Z", { projectId: p2.id }); // 10m
    await entry(ana, "2026-02-07T12:00:00Z", "2026-02-07T18:00:00Z", { projectId: p1.id, deleted: true }); // deleted: never counts
    await entry(ana, "2026-01-31T12:00:00Z", "2026-01-31T13:00:00Z", { projectId: p1.id }); // before the period
    await entry(ana, "2026-02-10T12:00:00Z", null, { projectId: p1.id }); // running
    await entry(other, "2026-02-02T12:00:00Z", "2026-02-02T20:00:00Z"); // another workspace
  });

  const sum = (rows: { seconds: number }[]) => rows.reduce((a, r) => a + r.seconds, 0);

  it("admin sees every member's finished entries in the period; deleted, out-of-range and running are not summed", async () => {
    const { rows, runningCount } = await tAdmin.reports.run({ from: FROM, to: TO });
    expect(rows).toHaveLength(5);
    expect(sum(rows)).toBe(3600 + 1800 + 17 + 7200 + 600);
    expect(runningCount).toBe(1);
  });

  it("filters by some people", async () => {
    const { rows } = await tAdmin.reports.run({ from: FROM, to: TO, userIds: [ana.userId, bia.userId] });
    expect(sum(rows)).toBe(3600 + 1800 + 17 + 7200);
    const one = await tAdmin.reports.run({ from: FROM, to: TO, userIds: [bia.userId] });
    expect(one.rows.map((r) => r.userName)).toEqual(["User rbia"]);
  });

  it("filters by client, project and task, and combines them with people", async () => {
    expect(sum((await tAdmin.reports.run({ from: FROM, to: TO, clientId: c1.id })).rows)).toBe(3600 + 7200);
    expect(sum((await tAdmin.reports.run({ from: FROM, to: TO, projectId: p2.id })).rows)).toBe(1800 + 600);
    expect(sum((await tAdmin.reports.run({ from: FROM, to: TO, projectId: p1.id, taskId: t1.id })).rows)).toBe(3600);
    expect(sum((await tAdmin.reports.run({ from: FROM, to: TO, clientId: c1.id, userIds: [bia.userId] })).rows)).toBe(7200);
  });

  it("'none' selects entries without a project", async () => {
    const { rows } = await tAdmin.reports.run({ from: FROM, to: TO, projectId: "none", clientId: c1.id });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ seconds: 17, projectId: null, clientId: null });
  });

  it("resolves client, project and task names", async () => {
    const { rows } = await tAdmin.reports.run({ from: FROM, to: TO, taskId: t1.id });
    expect(rows[0]).toMatchObject({ clientName: "3 Corações", projectName: "Arquitetura", taskName: "Revisão", userName: "User rana" });
  });

  it("the period is half-open on the start instant", async () => {
    const { rows } = await tAdmin.reports.run({ from: d("2026-02-02T12:00:00Z"), to: d("2026-02-03T12:00:00Z") });
    expect(rows).toHaveLength(1); // starts exactly at `from` (kept); the one at `to` is excluded
  });

  it("a member only gets their own hours, and asking for others is forbidden", async () => {
    const { rows } = await tAna.reports.run({ from: FROM, to: TO });
    expect(rows.every((r) => r.userId === ana.userId)).toBe(true);
    expect(sum(rows)).toBe(3600 + 1800 + 17);
    expect((await tAna.reports.run({ from: FROM, to: TO, userIds: [ana.userId] })).rows).toHaveLength(3);
    await expect(tAna.reports.run({ from: FROM, to: TO, userIds: [bia.userId] })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(tAna.reports.run({ from: FROM, to: TO, userIds: [ana.userId, bia.userId] })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("never leaks another workspace, even with its ids in the filter", async () => {
    const mine = await tAdmin.reports.run({ from: FROM, to: TO, userIds: [other.userId] });
    expect(mine.rows).toHaveLength(0);
    const theirs = await tOther.reports.run({ from: FROM, to: TO, projectId: p1.id });
    expect(theirs.rows).toHaveLength(0);
    expect(sum((await tOther.reports.run({ from: FROM, to: TO })).rows)).toBe(8 * 3600);
  });

  it("people(): admins list the whole workspace, members only themselves", async () => {
    expect((await tAdmin.reports.people()).map((p) => p.id).sort()).toEqual([admin.userId, ana.userId, bia.userId].sort());
    expect((await tAna.reports.people()).map((p) => p.id)).toEqual([ana.userId]);
  });

  it("keeps the history of removed and anonymized members", async () => {
    await db.update(workspaceMembers).set({ removedAt: new Date() }).where(eq(workspaceMembers.userId, bia.userId));
    await db.update(users).set({ deletedAt: new Date(), name: null }).where(eq(users.id, bia.userId));
    const people = await tAdmin.reports.people();
    expect(people.find((p) => p.id === bia.userId)).toMatchObject({ name: "Usuário removido", isRemoved: true });
    const { rows } = await tAdmin.reports.run({ from: FROM, to: TO, userIds: [bia.userId] });
    expect(rows[0].userName).toBe("Usuário removido");
  });
});
