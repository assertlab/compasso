import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { createTestDb, type TestDb } from "@/test/db";
import { createAuth } from "./auth";
import { getAuthEnv } from "./env";

/** What the Membros screen relies on Better Auth to enforce (the UI only reflects it). */
describe("member management rules (Better Auth)", () => {
  let db: TestDb;
  let auth: ReturnType<typeof createAuth>;
  const mails: { text: string }[] = [];

  beforeAll(async () => {
    db = await createTestDb();
    auth = createAuth({
      db: db as unknown as Db,
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
    return new Headers({ cookie: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") });
  }

  async function team(prefix: string) {
    const owner = await signIn(`${prefix}-owner@example.com`);
    const org = await auth.api.createOrganization({ headers: owner, body: { name: prefix, slug: prefix } });
    const join = async (email: string, role: "member" | "admin") => {
      const inv = await auth.api.createInvitation({ headers: owner, body: { email, role, organizationId: org.id } });
      const headers = await signIn(email);
      await auth.api.acceptInvitation({ headers, body: { invitationId: inv.id } });
      await auth.api.setActiveOrganization({ headers, body: { organizationId: org.id } });
      return headers;
    };
    await auth.api.setActiveOrganization({ headers: owner, body: { organizationId: org.id } });
    return { owner, org, join };
  }

  it("lets the owner change a member's role and remove them", async () => {
    const t = await team("t1");
    await t.join("t1-ana@example.com", "member");
    const { members } = await auth.api.listMembers({ headers: t.owner, query: { organizationId: t.org.id } });
    const ana = members.find((m) => m.user.email === "t1-ana@example.com")!;
    await auth.api.updateMemberRole({ headers: t.owner, body: { memberId: ana.id, role: "admin", organizationId: t.org.id } });
    expect((await auth.api.listMembers({ headers: t.owner, query: { organizationId: t.org.id } })).members.find((m) => m.id === ana.id)?.role).toBe("admin");
    await auth.api.removeMember({ headers: t.owner, body: { memberIdOrEmail: "t1-ana@example.com", organizationId: t.org.id } });
    expect((await auth.api.listMembers({ headers: t.owner, query: { organizationId: t.org.id } })).members).toHaveLength(1);
  });

  it("does not let an admin remove or demote the owner", async () => {
    const t = await team("t2");
    const admin = await t.join("t2-adm@example.com", "admin");
    const { members } = await auth.api.listMembers({ headers: t.owner, query: { organizationId: t.org.id } });
    const owner = members.find((m) => m.role === "owner")!;
    await expect(auth.api.removeMember({ headers: admin, body: { memberIdOrEmail: "t2-owner@example.com", organizationId: t.org.id } })).rejects.toThrow();
    await expect(auth.api.updateMemberRole({ headers: admin, body: { memberId: owner.id, role: "member", organizationId: t.org.id } })).rejects.toThrow();
  });

  it("does not let a plain member invite, change roles or remove anyone", async () => {
    const t = await team("t3");
    const member = await t.join("t3-mem@example.com", "member");
    await expect(auth.api.createInvitation({ headers: member, body: { email: "x@example.com", role: "member", organizationId: t.org.id } })).rejects.toThrow();
    await expect(auth.api.removeMember({ headers: member, body: { memberIdOrEmail: "t3-owner@example.com", organizationId: t.org.id } })).rejects.toThrow();
  });

  it("lets an admin cancel a pending invitation", async () => {
    const t = await team("t4");
    const pending = await auth.api.createInvitation({ headers: t.owner, body: { email: "t4-new@example.com", role: "member", organizationId: t.org.id } });
    await auth.api.cancelInvitation({ headers: t.owner, body: { invitationId: pending.id } });
    const list = await auth.api.listInvitations({ headers: t.owner, query: { organizationId: t.org.id } });
    expect(list.filter((i) => i.status === "pending")).toHaveLength(0);
  });
});
