import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { users, workspaceMembers, workspaces } from "@/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { createAuth } from "./auth";
import { getAuthEnv } from "./env";
import { resolveWorkspaceContext, roleFromAuth, type AuthSessionLike } from "./workspace-context";

describe("roleFromAuth", () => {
  it("maps owner and admin to admin, everything else to member", () => {
    expect(roleFromAuth("owner")).toBe("admin");
    expect(roleFromAuth("admin")).toBe("admin");
    expect(roleFromAuth("member,admin")).toBe("admin");
    expect(roleFromAuth("member")).toBe("member");
    expect(roleFromAuth(null)).toBe("member");
    expect(roleFromAuth("administrator")).toBe("member");
  });
});

describe("resolveWorkspaceContext", () => {
  let db: TestDb;
  let auth: ReturnType<typeof createAuth>;
  const mails: { text: string }[] = [];
  const asDb = () => db as unknown as Db;

  beforeAll(async () => {
    db = await createTestDb();
    auth = createAuth({
      db: asDb(),
      nextJsCookies: false,
      env: getAuthEnv({ NODE_ENV: "test", BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123" }),
      send: async (m) => void mails.push(m),
    });
  });

  async function signIn(email: string) {
    mails.length = 0;
    await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
    await new Promise((r) => setTimeout(r, 20));
    const otp = /(\d{6})/.exec(mails[0].text)![1];
    const res = await auth.api.signInEmailOTP({ body: { email, otp }, returnHeaders: true });
    const headers = new Headers({ cookie: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") });
    return { headers, user: res.response.user };
  }
  const sessionOf = (user: { id: string; email: string; name: string }, orgId: string | null): AuthSessionLike => ({
    user: { id: user.id, email: user.email, name: user.name, image: null },
    session: { activeOrganizationId: orgId },
  });

  it("provisions user, workspace and membership on first access, and is idempotent", async () => {
    const owner = await signIn("ana@example.com");
    const org = await auth.api.createOrganization({ headers: owner.headers, body: { name: "Acme Ltda", slug: "acme" } });

    const first = await resolveWorkspaceContext(asDb(), sessionOf(owner.user, org.id));
    expect(first.kind).toBe("ok");
    const again = await resolveWorkspaceContext(asDb(), sessionOf(owner.user, org.id));
    expect(again).toEqual(first);
    if (first.kind !== "ok") return;
    expect(first.context.role).toBe("admin");
    expect(first.context.workspaceName).toBe("Acme Ltda");
    expect(await db.select().from(workspaces).where(eq(workspaces.authOrgId, org.id))).toHaveLength(1);
    expect(await db.select().from(users).where(eq(users.email, "ana@example.com"))).toHaveLength(1);
  });

  it("returns no-org without an active organization and no-membership for a stranger", async () => {
    const u = await signIn("lone@example.com");
    expect((await resolveWorkspaceContext(asDb(), sessionOf(u.user, null))).kind).toBe("no-org");
    const owner = await signIn("boss@example.com");
    const org = await auth.api.createOrganization({ headers: owner.headers, body: { name: "Closed", slug: "closed" } });
    expect((await resolveWorkspaceContext(asDb(), sessionOf(u.user, org.id))).kind).toBe("no-membership");
  });

  it("links a pre-existing (migrated/Clerk) person by e-mail instead of duplicating", async () => {
    await db.insert(users).values({ clerkId: "user_legacy", email: "Legacy@Example.com", name: "Legacy Name" });
    const u = await signIn("legacy@example.com");
    const org = await auth.api.createOrganization({ headers: u.headers, body: { name: "Legacy Org", slug: "legacy-org" } });
    const res = await resolveWorkspaceContext(asDb(), sessionOf(u.user, org.id));
    expect(res.kind).toBe("ok");
    const rows = await db.select().from(users).where(eq(users.clerkId, "user_legacy"));
    expect(rows).toHaveLength(1);
    expect(rows[0].authId).toBe(u.user.id);
    expect(rows[0].name).toBe("Legacy Name");
  });

  it("never resurrects a deleted person nor un-archives a workspace", async () => {
    const u = await signIn("gone@example.com");
    const org = await auth.api.createOrganization({ headers: u.headers, body: { name: "Gone Org", slug: "gone-org" } });
    expect((await resolveWorkspaceContext(asDb(), sessionOf(u.user, org.id))).kind).toBe("ok");

    await db.update(workspaces).set({ archivedAt: new Date() }).where(eq(workspaces.authOrgId, org.id));
    expect((await resolveWorkspaceContext(asDb(), sessionOf(u.user, org.id))).kind).toBe("archived");

    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.authId, u.user.id));
    expect((await resolveWorkspaceContext(asDb(), sessionOf(u.user, org.id))).kind).toBe("deleted");
  });

  it("marks the membership as removed when Better Auth removes the member (afterRemoveMember hook)", async () => {
    const owner = await signIn("owner3@example.com");
    const org = await auth.api.createOrganization({ headers: owner.headers, body: { name: "Hook Org", slug: "hook-org" } });
    const invitation = await auth.api.createInvitation({ headers: owner.headers, body: { email: "guest3@example.com", role: "member", organizationId: org.id } });
    const guest = await signIn("guest3@example.com");
    await auth.api.acceptInvitation({ headers: guest.headers, body: { invitationId: invitation.id } });
    const res = await resolveWorkspaceContext(asDb(), sessionOf(guest.user, org.id));
    expect(res.kind).toBe("ok");
    if (res.kind !== "ok") return;
    expect(res.context.role).toBe("member");

    await auth.api.removeMember({ headers: owner.headers, body: { memberIdOrEmail: "guest3@example.com", organizationId: org.id } });
    const [row] = await db
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, res.context.workspaceId), eq(workspaceMembers.userId, res.context.userId)));
    expect(row.removedAt).not.toBeNull();
    expect((await resolveWorkspaceContext(asDb(), sessionOf(guest.user, org.id))).kind).toBe("no-membership");
  });
});
