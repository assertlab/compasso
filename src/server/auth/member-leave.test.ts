import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { users, workspaceMembers, workspaces } from "@/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { createAuth } from "./auth";
import { getAuthEnv } from "./env";
import { resolveWorkspaceContext } from "./workspace-context";

/** COMP-008: leaving a workspace on one's own must retire the domain membership, like removal by an admin does. */
describe("voluntary leave", () => {
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
    return { headers: new Headers({ cookie: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") }), user: res.response.user };
  }

  const sessionOf = (u: { id: string; email: string }, orgId: string) => ({
    user: { id: u.id, email: u.email, name: "Pessoa", image: null },
    session: { activeOrganizationId: orgId },
  });

  const removedAt = async (orgId: string, authUserId: string) => {
    const [row] = await db
      .select({ removedAt: workspaceMembers.removedAt })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(and(eq(workspaces.authOrgId, orgId), eq(users.authId, authUserId)));
    return row.removedAt;
  };

  it("marks the domain membership as removed, and only for the person who left", async () => {
    const owner = await signIn("leave-owner@example.com");
    const org = await auth.api.createOrganization({ headers: owner.headers, body: { name: "Leave", slug: "leave" } });
    const invitation = await auth.api.createInvitation({ headers: owner.headers, body: { email: "leaver@example.com", role: "member", organizationId: org.id } });
    const leaver = await signIn("leaver@example.com");
    await auth.api.acceptInvitation({ headers: leaver.headers, body: { invitationId: invitation.id } });
    await auth.api.setActiveOrganization({ headers: leaver.headers, body: { organizationId: org.id } });

    // both people exist in the domain tables (first access)
    expect((await resolveWorkspaceContext(asDb(), sessionOf(owner.user, org.id))).kind).toBe("ok");
    expect((await resolveWorkspaceContext(asDb(), sessionOf(leaver.user, org.id))).kind).toBe("ok");
    expect(await removedAt(org.id, leaver.user.id)).toBeNull();

    await auth.api.leaveOrganization({ headers: leaver.headers, body: { organizationId: org.id } });

    expect(await removedAt(org.id, leaver.user.id)).toBeInstanceOf(Date);
    expect(await removedAt(org.id, owner.user.id)).toBeNull();
    expect((await resolveWorkspaceContext(asDb(), sessionOf(leaver.user, org.id))).kind).toBe("no-membership");
  });

  it("a refused leave (sole owner) changes nothing", async () => {
    const owner = await signIn("sole-owner@example.com");
    const org = await auth.api.createOrganization({ headers: owner.headers, body: { name: "Sole", slug: "sole" } });
    await resolveWorkspaceContext(asDb(), sessionOf(owner.user, org.id));
    await expect(auth.api.leaveOrganization({ headers: owner.headers, body: { organizationId: org.id } })).rejects.toThrow();
    expect(await removedAt(org.id, owner.user.id)).toBeNull();
  });
});
