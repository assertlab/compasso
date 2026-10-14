import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { organizations, projects, tags, tasks, timeEntries, timeEntryAudit, timeEntryTags, users, workspaceMembers, workspaces } from "@/db/schema";
import { personalExportSchema } from "@/lib/schemas/personal-export";
import { addMember, createTestDb, seedWorkspace, type TestDb } from "@/test/db";
import { buildPersonalExport, personalExportFileName } from "./personal-export";

describe("buildPersonalExport (ADR-037)", () => {
  let db: TestDb;
  const asDb = () => db as unknown as Db;
  const NOW = new Date("2026-10-14T15:00:00.000Z");
  let ana: { workspaceId: string; userId: string };
  let bruno: { workspaceId: string; userId: string };
  const ids: string[] = [];

  beforeAll(async () => {
    db = await createTestDb();
    ana = await seedWorkspace(db, "ana"); // admin of "Workspace ana"
    bruno = await addMember(db, ana.workspaceId, "bruno");
    const ws = ana.workspaceId;
    const [org] = await db.insert(organizations).values({ workspaceId: ws, name: "Cliente A" }).returning();
    const [orgB] = await db.insert(organizations).values({ workspaceId: ws, name: "Só do Bruno" }).returning();
    const [proj] = await db.insert(projects).values({ workspaceId: ws, organizationId: org.id, name: "Projeto X", color: "#112233" }).returning();
    const [projB] = await db.insert(projects).values({ workspaceId: ws, organizationId: orgB.id, name: "Projeto do Bruno" }).returning();
    const [task] = await db.insert(tasks).values({ workspaceId: ws, projectId: proj.id, name: "Revisão" }).returning();
    const [taskB] = await db.insert(tasks).values({ workspaceId: ws, projectId: projB.id, name: "Tarefa do Bruno" }).returning();
    const [tag] = await db.insert(tags).values({ workspaceId: ws, name: "Reunião", color: "#aabbcc" }).returning();
    const [tagB] = await db.insert(tags).values({ workspaceId: ws, name: "Segredo do Bruno" }).returning();

    const [done] = await db
      .insert(timeEntries)
      .values({ workspaceId: ws, userId: ana.userId, projectId: proj.id, taskId: task.id, description: "Revisão do artigo", startedAt: new Date("2026-10-01T12:00:00Z"), endedAt: new Date("2026-10-01T14:30:00Z"), timezone: "America/Recife", isBillable: false })
      .returning();
    await db.insert(timeEntryTags).values({ timeEntryId: done.id, tagId: tag.id });
    const [removed] = await db
      .insert(timeEntries)
      .values({ workspaceId: ws, userId: ana.userId, description: "Lançado por engano", startedAt: new Date("2026-10-02T12:00:00Z"), endedAt: new Date("2026-10-02T13:00:00Z"), timezone: "America/Recife", deletedAt: new Date("2026-10-03T00:00:00Z") })
      .returning();
    const [running] = await db
      .insert(timeEntries)
      .values({ workspaceId: ws, userId: ana.userId, projectId: proj.id, description: "Em andamento", startedAt: new Date("2026-10-14T14:00:00Z"), timezone: "America/Recife" })
      .returning();
    const [theirs] = await db
      .insert(timeEntries)
      .values({ workspaceId: ws, userId: bruno.userId, projectId: projB.id, taskId: taskB.id, description: "Trabalho do Bruno", startedAt: new Date("2026-10-01T12:00:00Z"), endedAt: new Date("2026-10-01T13:00:00Z"), timezone: "America/Recife" })
      .returning();
    await db.insert(timeEntryTags).values({ timeEntryId: theirs.id, tagId: tagB.id });
    // An admin's correction of Bruno's entry: history that belongs to the workspace, not to Ana's data.
    await db.insert(timeEntryAudit).values({ workspaceId: ws, timeEntryId: theirs.id, actorUserId: ana.userId, action: "update", changes: { description: { from: "x", to: "y" } } });

    // Ana also worked in a workspace she has since left.
    const [other] = await db.insert(workspaces).values({ authOrgId: "org_old", name: "Workspace antigo", slug: "ws-old" }).returning();
    await db.insert(workspaceMembers).values({ workspaceId: other.id, userId: ana.userId, role: "member", removedAt: new Date("2026-09-01T00:00:00Z") });
    const [oldOrg] = await db.insert(organizations).values({ workspaceId: other.id, name: "Cliente antigo" }).returning();
    const [oldProj] = await db.insert(projects).values({ workspaceId: other.id, organizationId: oldOrg.id, name: "Projeto antigo" }).returning();
    await db
      .insert(timeEntries)
      .values({ workspaceId: other.id, userId: ana.userId, projectId: oldProj.id, description: "Antes de sair", startedAt: new Date("2026-08-01T12:00:00Z"), endedAt: new Date("2026-08-01T13:00:00Z"), timezone: "America/Sao_Paulo" });

    ids.push(ana.userId, bruno.userId, ana.workspaceId, other.id, org.id, orgB.id, proj.id, projB.id, task.id, taskB.id, tag.id, tagB.id, done.id, removed.id, running.id, theirs.id);
  });

  const exportFor = (userId: string) => buildPersonalExport(asDb(), userId, { now: NOW, version: "9.9.9" });
  const entriesOf = (data: Awaited<ReturnType<typeof exportFor>>, name: string) => data.workspaces.find((w) => w.name === name)!.entries;

  it("has the versioned envelope and the account data", async () => {
    const data = await exportFor(ana.userId);
    expect(data.schemaVersion).toBe(1);
    expect(data.exportedAt).toBe("2026-10-14T15:00:00.000Z");
    expect(data.generator).toEqual({ name: "compasso", version: "9.9.9" });
    expect(data.account).toEqual({ name: "User ana", email: "ana@example.com", timezone: "America/Recife" });
    expect(() => personalExportSchema.parse(JSON.parse(JSON.stringify(data)))).not.toThrow();
  });

  it("exports the person's entries faithfully: UTC instants, zone, billable, tags, removed entries and a running timer", async () => {
    const data = await exportFor(ana.userId);
    const entries = entriesOf(data, "Workspace ana");
    expect(entries.map((e) => e.description)).toEqual(["Revisão do artigo", "Lançado por engano", "Em andamento"]);
    expect(entries[0]).toEqual({
      projectKey: expect.any(String),
      taskKey: expect.any(String),
      tagKeys: [expect.any(String)],
      description: "Revisão do artigo",
      startedAt: "2026-10-01T12:00:00.000Z",
      endedAt: "2026-10-01T14:30:00.000Z",
      timezone: "America/Recife",
      billable: false,
      deletedAt: null,
    });
    expect(entries[1].deletedAt).toBe("2026-10-03T00:00:00.000Z");
    expect(entries[2].endedAt).toBeNull();
    expect(JSON.stringify(entries)).not.toMatch(/duration/i);
  });

  it("brings only the catalog the person's own entries reference, with keys that resolve", async () => {
    const w = (await exportFor(ana.userId)).workspaces.find((x) => x.name === "Workspace ana")!;
    expect(w.clients.map((c) => c.name)).toEqual(["Cliente A"]);
    expect(w.projects).toEqual([{ key: expect.any(String), clientKey: w.clients[0].key, name: "Projeto X", color: "#112233", archived: false }]);
    expect(w.tasks.map((t) => t.name)).toEqual(["Revisão"]);
    expect(w.tags).toEqual([{ key: expect.any(String), name: "Reunião", color: "#aabbcc" }]);
    expect(w.role).toBe("admin");
  });

  it("contains nothing of other people: entries, catalog, e-mails, correction history or any database id", async () => {
    const json = JSON.stringify(await exportFor(ana.userId));
    for (const leaked of ["Trabalho do Bruno", "Projeto do Bruno", "Só do Bruno", "Tarefa do Bruno", "Segredo do Bruno", "bruno@example.com", "User bruno"]) {
      expect(json).not.toContain(leaked);
    }
    expect(json).not.toMatch(/audit|actor/i);
    for (const id of ids) expect(json).not.toContain(id);
    expect(json).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  });

  it("gives the other person their own file, scoped the same way", async () => {
    const data = await exportFor(bruno.userId);
    expect(data.account.email).toBe("bruno@example.com");
    expect(data.workspaces).toHaveLength(1);
    expect(data.workspaces[0].role).toBe("member");
    expect(data.workspaces[0].entries.map((e) => e.description)).toEqual(["Trabalho do Bruno"]);
    expect(JSON.stringify(data)).not.toContain("Revisão do artigo");
  });

  it("includes a workspace the person has left, with their entries and no role", async () => {
    const data = await exportFor(ana.userId);
    expect(data.workspaces.map((w) => w.name)).toEqual(["Workspace ana", "Workspace antigo"]);
    const old = data.workspaces.find((w) => w.name === "Workspace antigo")!;
    expect(old.role).toBeNull();
    expect(old.entries).toHaveLength(1);
    expect(old.entries[0].timezone).toBe("America/Sao_Paulo");
    expect(old.projects.map((p) => p.name)).toEqual(["Projeto antigo"]);
  });

  it("keys are unique across the whole file", async () => {
    const data = await exportFor(ana.userId);
    const all = data.workspaces.flatMap((w) => [w.key, ...w.clients.map((c) => c.key), ...w.projects.map((p) => p.key), ...w.tasks.map((t) => t.key), ...w.tags.map((t) => t.key)]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("is a valid, empty file for someone with no data, and fails for an unknown user", async () => {
    const [solo] = await db.insert(users).values({ email: "solo@example.com", name: null }).returning();
    const data = await exportFor(solo.id);
    expect(data.workspaces).toEqual([]);
    expect(data.account.name).toBeNull();
    await expect(exportFor("00000000-0000-4000-8000-000000000000")).rejects.toThrow("User not found");
  });

  it("is deterministic for the same data", async () => {
    expect(await exportFor(ana.userId)).toEqual(await exportFor(ana.userId));
  });

  it("names the file after the day, in UTC", () => {
    expect(personalExportFileName(new Date("2026-10-14T23:59:00.000Z"))).toBe("compasso-meus-dados-2026-10-14.json");
  });

  it("cleans up nothing: reading never writes", async () => {
    const before = await db.select().from(timeEntries).where(eq(timeEntries.userId, ana.userId));
    await exportFor(ana.userId);
    expect(await db.select().from(timeEntries).where(eq(timeEntries.userId, ana.userId))).toEqual(before);
  });
});

describe("buildPersonalExport tag order (ADR-037)", () => {
  it("lists an entry's tags in catalog order whatever order they were linked in", async () => {
    const db = await createTestDb();
    const a = await seedWorkspace(db, "tagorder");
    const [zeta] = await db.insert(tags).values({ workspaceId: a.workspaceId, name: "Zeta" }).returning();
    const [alfa] = await db.insert(tags).values({ workspaceId: a.workspaceId, name: "Alfa" }).returning();
    const [meio] = await db.insert(tags).values({ workspaceId: a.workspaceId, name: "Meio" }).returning();
    const [entry] = await db
      .insert(timeEntries)
      .values({ workspaceId: a.workspaceId, userId: a.userId, description: "x", startedAt: new Date("2026-10-01T12:00:00Z"), endedAt: new Date("2026-10-01T13:00:00Z"), timezone: "America/Recife" })
      .returning();
    // linked in the "wrong" order on purpose
    for (const t of [zeta, alfa, meio]) await db.insert(timeEntryTags).values({ timeEntryId: entry.id, tagId: t.id });

    const w = (await buildPersonalExport(db as unknown as Db, a.userId, { now: new Date("2026-10-14T15:00:00Z"), version: "9.9.9" })).workspaces[0];
    const nameOf = new Map(w.tags.map((t) => [t.key, t.name]));
    expect(w.tags.map((t) => t.name)).toEqual(["Alfa", "Meio", "Zeta"]);
    expect(w.entries[0].tagKeys.map((k) => nameOf.get(k))).toEqual(["Alfa", "Meio", "Zeta"]);
  });
});
