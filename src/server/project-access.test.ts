import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { projectMembers, timeEntries, workspaceMembers } from "@/db/schema";
import { addMember, createTestDb, seedWorkspace, type TestDb } from "@/test/db";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { createTenant, type Tenant } from "./tenant";

const TZ = "America/Recife";
type Who = { workspaceId: string; userId: string };

describe("project participation (access model)", () => {
  let db: TestDb;
  let admin: Who;
  let ana: Who;
  let bia: Who;
  let gone: Who;
  let other: Who;
  let tAdmin: Tenant;
  let tAna: Tenant;
  let tBia: Tenant;
  let tOther: Tenant;
  let open: { id: string }; // Ana takes part
  let closed: { id: string }; // nobody but the creator
  let openTask: { id: string };
  let closedTask: { id: string };

  const make = (u: Who, role: "admin" | "member") => createTenant(db, { ...u, role, timezone: TZ }, { now: () => new Date("2026-02-27T12:00:00Z") });
  const range = (extra: object = {}) => ({ startedAt: "2026-02-27T09:00:00Z", endedAt: "2026-02-27T10:00:00Z", ...extra });

  beforeAll(async () => {
    db = await createTestDb();
    admin = await seedWorkspace(db, "pa");
    other = await seedWorkspace(db, "pb");
    ana = await addMember(db, admin.workspaceId, "pana");
    bia = await addMember(db, admin.workspaceId, "pbia");
    gone = await addMember(db, admin.workspaceId, "pgone");
    await db.update(workspaceMembers).set({ removedAt: new Date() }).where(eq(workspaceMembers.userId, gone.userId));
    tAdmin = make(admin, "admin");
    tAna = make(ana, "member");
    tBia = make(bia, "member");
    tOther = make(other, "admin");

    const org = await tAdmin.organizations.create({ name: "Cliente" });
    open = await tAdmin.projects.create({ organizationId: org.id, name: "Aberto" });
    closed = await tAdmin.projects.create({ organizationId: org.id, name: "Fechado" });
    openTask = await tAdmin.tasks.create({ projectId: open.id, name: "Tarefa aberta" });
    closedTask = await tAdmin.tasks.create({ projectId: closed.id, name: "Tarefa fechada" });
    await tAdmin.projectMembers.add(open.id, ana.userId);
  }, 60_000);

  describe("logging hours", () => {
    it("lets admins use any project, even without taking part", async () => {
      await expect(tAdmin.timeEntries.createManual(range({ projectId: closed.id, taskId: closedTask.id }))).resolves.toBeDefined();
    });

    it("lets a member use projects they take part in, and blocks the rest", async () => {
      await expect(tAna.timeEntries.createManual(range({ projectId: open.id, taskId: openTask.id }))).resolves.toBeDefined();
      await expect(tAna.timeEntries.createManual(range({ projectId: closed.id }))).rejects.toMatchObject({
        fieldErrors: { projectId: "Você não participa deste projeto." },
      });
      await expect(tAna.timeEntries.startTimer({ projectId: closed.id })).rejects.toBeInstanceOf(ValidationError);
      await expect(tBia.timeEntries.createManual(range({ projectId: open.id }))).rejects.toBeInstanceOf(ValidationError);
    });

    it("blocks moving an existing entry to a project the member is not in, but keeps editing the old one", async () => {
      const mine = await tAna.timeEntries.createManual(range({ projectId: open.id, description: "antes" }));
      await expect(tAna.timeEntries.update(mine.id, { projectId: closed.id })).rejects.toBeInstanceOf(ValidationError);
      await tAdmin.projectMembers.remove(open.id, ana.userId);
      // The link is unchanged, so the entry stays editable after the member leaves the project.
      await expect(tAna.timeEntries.update(mine.id, { description: "depois" })).resolves.toMatchObject({ description: "depois", projectId: open.id });
      // But the play button (a *new* use of the project) is blocked.
      await expect(tAna.timeEntries.startFrom(mine.id)).rejects.toBeInstanceOf(ValidationError);
      await tAdmin.projectMembers.add(open.id, ana.userId);
      await expect(tAna.timeEntries.startFrom(mine.id)).resolves.toBeDefined();
      await tAna.timeEntries.stopTimer();
    });
  });

  describe("what members see", () => {
    it("sees the client and project names of the whole workspace", async () => {
      expect((await tAna.projects.list()).map((p) => p.name).sort()).toEqual(["Aberto", "Fechado"]);
      expect((await tAna.organizations.list()).map((o) => o.name)).toEqual(["Cliente"]);
    });

    it("sees tasks only of the projects they take part in", async () => {
      expect((await tAna.tasks.list(open.id)).map((t) => t.id)).toEqual([openTask.id]);
      expect(await tAna.tasks.list(closed.id)).toEqual([]);
      await expect(tAna.tasks.get(closedTask.id)).rejects.toBeInstanceOf(NotFoundError);
      await expect(tAna.tasks.get(openTask.id)).resolves.toMatchObject({ id: openTask.id });
      expect(await tBia.tasks.list(open.id)).toEqual([]);
      expect((await tAdmin.tasks.list(closed.id)).map((t) => t.id)).toEqual([closedTask.id]);
    });

    it("listAll gives members their projects' tasks plus the ones on their own entries", async () => {
      expect((await tAna.tasks.listAll()).map((t) => t.id)).toEqual([openTask.id]);
      expect(await tBia.tasks.listAll()).toEqual([]);
      expect((await tAdmin.tasks.listAll()).map((t) => t.id).sort()).toEqual([openTask.id, closedTask.id].sort());
      // A task already on the member's own entry keeps its label even after leaving the project.
      await tAdmin.projectMembers.add(closed.id, bia.userId);
      const e = await tBia.timeEntries.createManual(range({ projectId: closed.id, taskId: closedTask.id }));
      await tAdmin.projectMembers.remove(closed.id, bia.userId);
      expect((await tBia.tasks.listAll()).map((t) => t.id)).toEqual([closedTask.id]);
      await tBia.timeEntries.softDelete(e.id);
    });

    it("never shows another person's entries", async () => {
      const day = { from: new Date("2026-02-27T00:00:00Z"), to: new Date("2026-02-28T00:00:00Z") };
      await expect(tAna.timeEntries.list({ ...day, userId: admin.userId })).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe("managing participants", () => {
    it("adds the creator of a new project", async () => {
      const org = (await tAdmin.organizations.list())[0];
      const p = await tAdmin.projects.create({ organizationId: org.id, name: "Novo" });
      expect((await tAdmin.projectMembers.list(p.id)).map((m) => m.userId)).toEqual([admin.userId]);
    });

    it("is admin-only", async () => {
      await expect(tAna.projectMembers.add(open.id, bia.userId)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(tAna.projectMembers.remove(open.id, ana.userId)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(tAna.projectMembers.list(open.id)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(tAna.projectMembers.candidates(open.id)).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("lists participants and the people who could be added", async () => {
      const participants = await tAdmin.projectMembers.list(open.id);
      expect(participants.map((p) => p.userId)).toContain(ana.userId);
      const candidates = (await tAdmin.projectMembers.candidates(open.id)).map((p) => p.userId);
      expect(candidates).toContain(bia.userId);
      expect(candidates).not.toContain(ana.userId);
      expect(candidates).not.toContain(gone.userId); // removed from the workspace
      expect(candidates).not.toContain(other.userId); // another workspace
    });

    it("adding twice is harmless, and only active members of this workspace can be added", async () => {
      await tAdmin.projectMembers.add(open.id, bia.userId);
      await tAdmin.projectMembers.add(open.id, bia.userId);
      expect((await tAdmin.projectMembers.list(open.id)).filter((p) => p.userId === bia.userId)).toHaveLength(1);
      await tAdmin.projectMembers.remove(open.id, bia.userId);
      await expect(tAdmin.projectMembers.add(open.id, gone.userId)).rejects.toBeInstanceOf(NotFoundError);
      await expect(tAdmin.projectMembers.add(open.id, other.userId)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("never crosses workspaces", async () => {
      await expect(tOther.projectMembers.add(open.id, other.userId)).rejects.toBeInstanceOf(NotFoundError);
      await expect(tOther.projectMembers.list(open.id)).rejects.toBeInstanceOf(NotFoundError);
      expect((await tAdmin.projectMembers.list(open.id)).length).toBeGreaterThan(0);
    });

    it("removing a participant keeps their logged hours", async () => {
      const before = await db.select().from(timeEntries).where(eq(timeEntries.userId, ana.userId));
      await tAdmin.projectMembers.remove(open.id, ana.userId);
      const after = await db.select().from(timeEntries).where(eq(timeEntries.userId, ana.userId));
      expect(after).toHaveLength(before.length);
      await tAdmin.projectMembers.add(open.id, ana.userId);
    });
  });

  it("migration backfill puts every active member in every existing project, and only them", async () => {
    await db.delete(projectMembers);
    const file = readFileSync("drizzle/0003_project_members.sql", "utf8");
    const statement = file.slice(file.indexOf("INSERT INTO")).trim();
    await db.execute(sql.raw(statement));

    const rows = await db.select().from(projectMembers).where(eq(projectMembers.workspaceId, admin.workspaceId));
    const pairs = new Set(rows.map((r) => `${r.projectId}:${r.userId}`));
    const projects = (await tAdmin.projects.list({ includeArchived: true })).map((p) => p.id);
    for (const projectId of projects) {
      for (const who of [admin, ana, bia]) expect(pairs.has(`${projectId}:${who.userId}`)).toBe(true);
      expect(pairs.has(`${projectId}:${gone.userId}`)).toBe(false); // removed from the workspace
      expect(pairs.has(`${projectId}:${other.userId}`)).toBe(false); // another workspace
    }
    expect(rows).toHaveLength(projects.length * 3);
  });

  describe("members overview", () => {
    it("lists active members with their projects, and leaves out removed ones", async () => {
      const overview = await tAdmin.projectMembers.overview();
      const ids = overview.map((m) => m.userId);
      expect(ids).toContain(ana.userId);
      expect(ids).not.toContain(gone.userId);
      const anaRow = overview.find((m) => m.userId === ana.userId);
      expect(anaRow?.projects.map((p) => p.name)).toContain("Aberto");
      expect(anaRow?.projects.map((p) => p.name)).not.toContain("Fechado");
      expect(overview.find((m) => m.userId === bia.userId)?.projects).toEqual([]);
    });

    it("is admin-only and never shows another workspace's people", async () => {
      await expect(tAna.projectMembers.overview()).rejects.toBeInstanceOf(ForbiddenError);
      const foreign = await tOther.projectMembers.overview();
      expect(foreign.map((m) => m.userId)).not.toContain(ana.userId);
    });
  });
});
