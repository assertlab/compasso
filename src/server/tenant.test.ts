import { beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { createTestDb, seedWorkspace, type TestDb } from "@/test/db";
import { ForbiddenError, NotFoundError } from "./errors";
import { createTenant, type Tenant } from "./tenant";

const TZ = "America/Recife";

// Two workspaces, A (the caller) and B (another tenant), each with the same catalog names
// on purpose: names are unique per workspace, ids never are interchangeable.
describe("tenant isolation", () => {
  let db: TestDb;
  let a: { workspaceId: string; userId: string };
  let b: { workspaceId: string; userId: string };
  let tA: Tenant;
  let tB: Tenant;
  let tAMember: Tenant;
  let orgA: { id: string };
  let orgB: { id: string };
  let projA: { id: string };
  let projB: { id: string };
  let taskB: { id: string };
  let tagB: { id: string };

  beforeAll(async () => {
    db = await createTestDb();
    a = await seedWorkspace(db, "a");
    b = await seedWorkspace(db, "b");
    tA = createTenant(db, { ...a, role: "admin", timezone: TZ });
    tB = createTenant(db, { ...b, role: "admin", timezone: TZ });
    tAMember = createTenant(db, { ...a, role: "member", timezone: TZ });

    orgA = await tA.organizations.create({ name: "Cliente" });
    orgB = await tB.organizations.create({ name: "Cliente" });
    projA = await tA.projects.create({ organizationId: orgA.id, name: "Projeto" });
    projB = await tB.projects.create({ organizationId: orgB.id, name: "Projeto" });
    await tA.tasks.create({ projectId: projA.id, name: "Tarefa" });
    taskB = await tB.tasks.create({ projectId: projB.id, name: "Tarefa" });
    await tA.tags.create({ name: "tag" });
    tagB = await tB.tags.create({ name: "tag" });
  }, 60_000);

  it("allows the same names in different workspaces", () => {
    expect(orgA.id).not.toBe(orgB.id);
  });

  it("lists only the caller's workspace", async () => {
    expect((await tA.organizations.list()).map((o) => o.id)).toEqual([orgA.id]);
    expect((await tA.projects.list()).map((p) => p.id)).toEqual([projA.id]);
    expect((await tA.tags.list()).map((t) => t.id)).not.toContain(tagB.id);
    expect((await tA.tasks.list(projA.id)).every((t) => t.workspaceId === a.workspaceId)).toBe(true);
  });

  it("treats another workspace's ids as not found on read", async () => {
    await expect(tA.organizations.get(orgB.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(tA.projects.get(projB.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(tA.tasks.get(taskB.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(tA.tags.get(tagB.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(tA.tasks.list(projB.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("cannot update another workspace's rows, and leaves them untouched", async () => {
    await expect(tA.organizations.update(orgB.id, { name: "Hackeado", isArchived: true })).rejects.toBeInstanceOf(NotFoundError);
    await expect(tA.projects.update(projB.id, { name: "Hackeado" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(tA.tasks.update(taskB.id, { isCompleted: true })).rejects.toBeInstanceOf(NotFoundError);
    await expect(tA.tags.update(tagB.id, { name: "Hackeado" })).rejects.toBeInstanceOf(NotFoundError);

    expect(await tB.organizations.get(orgB.id)).toMatchObject({ name: "Cliente", isArchived: false });
    expect(await tB.projects.get(projB.id)).toMatchObject({ name: "Projeto" });
    expect(await tB.tasks.get(taskB.id)).toMatchObject({ isCompleted: false });
    expect(await tB.tags.get(tagB.id)).toMatchObject({ name: "tag" });
  });

  it("cannot attach new rows to another workspace's parents", async () => {
    await expect(tA.projects.create({ organizationId: orgB.id, name: "Intruso" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(tA.tasks.create({ projectId: projB.id, name: "Intrusa" })).rejects.toBeInstanceOf(NotFoundError);
    expect((await tB.projects.list()).map((p) => p.name)).toEqual(["Projeto"]);
  });

  it("cannot move a project under another workspace's organization", async () => {
    await expect(tA.projects.update(projA.id, { organizationId: orgB.id })).rejects.toBeInstanceOf(NotFoundError);
    expect((await tA.projects.get(projA.id)).organizationId).toBe(orgA.id);
  });

  it("stamps workspace_id from the session even if the input tries to choose it", async () => {
    const smuggled = await tA.organizations.create({ name: "Contrabando", workspaceId: b.workspaceId } as never);
    expect(smuggled.workspaceId).toBe(a.workspaceId);
    expect((await tB.organizations.list()).map((o) => o.name)).not.toContain("Contrabando");
  });

  it("keeps archived items out of lists unless asked", async () => {
    const org = await tA.organizations.create({ name: "Antiga" });
    await tA.organizations.update(org.id, { isArchived: true });
    expect((await tA.organizations.list()).map((o) => o.id)).not.toContain(org.id);
    expect((await tA.organizations.list({ includeArchived: true })).map((o) => o.id)).toContain(org.id);
  });

  it("lets members read but not change the catalog", async () => {
    expect((await tAMember.organizations.list()).map((o) => o.id)).toContain(orgA.id);
    await expect(tAMember.organizations.create({ name: "Nova" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(tAMember.projects.update(projA.id, { name: "Outro" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(tAMember.tags.create({ name: "x" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("validates input before touching the database", async () => {
    await expect(tA.organizations.create({ name: "   " })).rejects.toBeInstanceOf(ZodError);
    await expect(tA.projects.create({ organizationId: "not-a-uuid", name: "x" })).rejects.toBeInstanceOf(ZodError);
    await expect(tA.tags.create({ name: "x", color: "red" })).rejects.toBeInstanceOf(ZodError);
  });

  it("returns the current row for an empty patch", async () => {
    expect(await tA.projects.update(projA.id, {})).toMatchObject({ id: projA.id, name: "Projeto" });
  });
});
