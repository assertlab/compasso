import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { users, workspaceMembers, workspaces } from "@/db/schema";
import { addMember, createTestDb, seedWorkspace, type TestDb } from "@/test/db";
import { migrateClerkToAuth } from "./migrate-from-clerk";

describe("migrateClerkToAuth", () => {
  let db: TestDb;
  const run = (apply: boolean) => migrateClerkToAuth(db as unknown as Db, { apply });

  beforeEach(async () => {
    db = await createTestDb();
    const a = await seedWorkspace(db, "a", "clerk"); // first admin of workspace a
    await addMember(db, a.workspaceId, "a2", "admin", "clerk");
    await addMember(db, a.workspaceId, "a3", "member", "clerk");
    await seedWorkspace(db, "b", "clerk");
  });

  const roles = async () => (await db.select().from(authSchema.member)).map((m) => m.role).sort();

  it("dry-run counts and writes nothing", async () => {
    const r = await run(false);
    expect(r.users.toCreate).toBe(4);
    expect(r.workspaces.toCreate).toBe(2);
    expect(r.members.toCreate).toBe(4);
    expect(await db.select().from(authSchema.user)).toHaveLength(0);
    expect(await db.select().from(authSchema.member)).toHaveLength(0);
    expect((await db.select().from(users).where(eq(users.email, "a@example.com")))[0].authId).toBeNull();
  });

  it("applies: links ids, makes the first admin the owner and leaves no orphans", async () => {
    const r = await run(true);
    expect(r).toMatchObject({ users: { created: 4 }, workspaces: { created: 2 }, members: { created: 4, owners: 2, admins: 1, members: 1 }, orphans: 0 });
    expect(await roles()).toEqual(["admin", "member", "owner", "owner"]);
    const [u] = await db.select().from(users).where(eq(users.email, "a@example.com"));
    const [au] = await db.select().from(authSchema.user).where(eq(authSchema.user.id, u.authId!));
    expect(au).toMatchObject({ email: "a@example.com", emailVerified: true, name: "User a" });
  });

  it("is idempotent", async () => {
    await run(true);
    const again = await run(true);
    expect(again).toMatchObject({ users: { created: 0 }, workspaces: { created: 0 }, members: { created: 0 }, orphans: 0 });
    expect(await db.select().from(authSchema.member)).toHaveLength(4);
  });

  it("skips deleted users, archived workspaces and removed members", async () => {
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.email, "a3@example.com"));
    await db.update(workspaces).set({ archivedAt: new Date() }).where(eq(workspaces.slug, "ws-b"));
    const [a2] = await db.select().from(users).where(eq(users.email, "a2@example.com"));
    await db.update(workspaceMembers).set({ removedAt: new Date() }).where(eq(workspaceMembers.userId, a2.id));
    const r = await run(true);
    expect(r.users.created).toBe(3); // a, a2 (removed from the workspace) and b: the people are still active
    expect(r.workspaces.created).toBe(1);
    expect(r.members.created).toBe(1);
    expect(r.orphans).toBe(0);
  });

  it("reuses Better Auth rows that already exist by e-mail and slug (rerun after a partial failure)", async () => {
    await db.insert(authSchema.user).values({ id: "pre-user", email: "a@example.com", name: "Pre", emailVerified: true });
    await db.insert(authSchema.organization).values({ id: "pre-org", name: "Pre", slug: "ws-a", createdAt: new Date() });
    const r = await run(true);
    expect(r.users).toMatchObject({ linked: 1, created: 3 });
    expect(r.workspaces).toMatchObject({ linked: 1, created: 1 });
    const [w] = await db.select().from(workspaces).where(eq(workspaces.slug, "ws-a"));
    expect(w.authOrgId).toBe("pre-org");
    expect(r.orphans).toBe(0);
  });
});
