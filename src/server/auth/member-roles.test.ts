import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { users, workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";
import { addMember, createTestDb, seedWorkspace, type TestDb } from "@/test/db";
import { authRolesByUser, strongestRole } from "./member-roles";

describe("strongestRole", () => {
  it("picks the strongest of a comma-separated list", () => {
    expect(strongestRole("member,owner")).toBe("owner");
    expect(strongestRole("admin")).toBe("admin");
    expect(strongestRole("member")).toBe("member");
    expect(strongestRole(null)).toBe("member");
  });
});

describe("authRolesByUser", () => {
  let db: TestDb;
  let a: { workspaceId: string; userId: string };
  let b: { workspaceId: string; userId: string };
  let bia: { workspaceId: string; userId: string };

  beforeAll(async () => {
    db = await createTestDb();
    a = await seedWorkspace(db, "ra");
    bia = await addMember(db, a.workspaceId, "rbia");
    b = await seedWorkspace(db, "rb");
    const link = async (userId: string, authUser: string) => {
      await db.insert(authSchema.user).values({ id: authUser, email: `${authUser}@example.com`, name: authUser });
      await db.update(users).set({ authId: authUser }).where(eq(users.id, userId));
    };
    await link(a.userId, "au-a");
    await link(bia.userId, "au-bia");
    await link(b.userId, "au-b");
    await db.insert(authSchema.organization).values([
      { id: "org-a", name: "A", slug: "a", createdAt: new Date() },
      { id: "org-b", name: "B", slug: "b", createdAt: new Date() },
    ]);
    await db.update(workspaces).set({ authOrgId: "org-a" }).where(eq(workspaces.id, a.workspaceId));
    await db.update(workspaces).set({ authOrgId: "org-b" }).where(eq(workspaces.id, b.workspaceId));
    await db.insert(authSchema.member).values([
      { id: "m1", organizationId: "org-a", userId: "au-a", role: "owner", createdAt: new Date() },
      { id: "m2", organizationId: "org-a", userId: "au-bia", role: "member", createdAt: new Date() },
      { id: "m3", organizationId: "org-b", userId: "au-b", role: "owner", createdAt: new Date() },
    ]);
  });

  it("returns the roles of that workspace only", async () => {
    const roles = await authRolesByUser(db as unknown as Db, a.workspaceId);
    expect(roles.get(a.userId)).toBe("owner");
    expect(roles.get(bia.userId)).toBe("member");
    expect(roles.has(b.userId)).toBe(false);
  });
});
