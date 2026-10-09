import { beforeAll, describe, expect, it } from "vitest";
import * as authSchema from "@/db/auth-schema";
import type { Db } from "@/db";
import { createTestDb, type TestDb } from "@/test/db";
import { createAuth } from "./auth";
import { getAuthEnv } from "./env";

/**
 * Exercises the real Better Auth (email OTP, organization, invitations, hooks) against PGlite with the real
 * migrations. It proves the logic and the schema; it does NOT prove the neon-http driver (run the app for that).
 */
describe("better auth", () => {
  let db: TestDb;
  let auth: ReturnType<typeof createAuth>;
  const mails: { to: string; subject: string; text: string }[] = [];

  beforeAll(async () => {
    db = await createTestDb();
    auth = createAuth({
      db: db as unknown as Db,
      nextJsCookies: false,
      env: getAuthEnv({ NODE_ENV: "test", BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123", BETTER_AUTH_URL: "http://localhost:3000" }),
      send: async (m) => {
        mails.push(m);
      },
    });
  });

  async function signIn(email: string) {
    mails.length = 0;
    await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
    await new Promise((r) => setTimeout(r, 20)); // the OTP mail is intentionally fire-and-forget
    const otp = /(\d{6})/.exec(mails[0].text)![1];
    const res = await auth.api.signInEmailOTP({ body: { email, otp }, returnHeaders: true });
    const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    return { headers: new Headers({ cookie }), user: res.response.user };
  }

  it("signs in with an e-mail code, creates an organization and invites a second user who joins", async () => {
    const owner = await signIn("owner@example.com");
    const org = await auth.api.createOrganization({ headers: owner.headers, body: { name: "Acme", slug: "acme" } });
    await auth.api.setActiveOrganization({ headers: owner.headers, body: { organizationId: org.id } });

    mails.length = 0;
    const invitation = await auth.api.createInvitation({ headers: owner.headers, body: { email: "guest@example.com", role: "member", organizationId: org.id } });
    expect(mails.at(-1)?.text).toContain(`/accept-invitation/${invitation.id}`);

    const guest = await signIn("guest@example.com");
    await auth.api.acceptInvitation({ headers: guest.headers, body: { invitationId: invitation.id } });
    const members = await auth.api.listMembers({ headers: owner.headers, query: { organizationId: org.id } });
    expect(members.members.map((m) => m.role).sort()).toEqual(["member", "owner"]);

    // the session hook: a returning user lands in their first organization
    const again = await signIn("owner@example.com");
    expect((await auth.api.getSession({ headers: again.headers }))?.session.activeOrganizationId).toBe(org.id);
  });

  it("does not let another e-mail accept someone else's invitation", async () => {
    const owner = await signIn("owner2@example.com");
    const org = await auth.api.createOrganization({ headers: owner.headers, body: { name: "Beta", slug: "beta" } });
    const invitation = await auth.api.createInvitation({ headers: owner.headers, body: { email: "right@example.com", role: "member", organizationId: org.id } });
    const wrong = await signIn("wrong@example.com");
    await expect(auth.api.acceptInvitation({ headers: wrong.headers, body: { invitationId: invitation.id } })).rejects.toThrow();
  });

  it("rejects a wrong code", async () => {
    await auth.api.sendVerificationOTP({ body: { email: "x@example.com", type: "sign-in" } });
    await expect(auth.api.signInEmailOTP({ body: { email: "x@example.com", otp: "000000" } })).rejects.toThrow();
  });

  it("stores nothing but identity for social accounts (tokens stripped)", async () => {
    const ctx = await auth.$context;
    const u = await signIn("social@example.com");
    await ctx.internalAdapter.createAccount({ userId: u.user.id, providerId: "google", accountId: "g-1", accessToken: "secret-a", refreshToken: "secret-r", idToken: "secret-i" });
    const rows = await db.select().from(authSchema.account);
    const row = rows.find((r) => r.providerId === "google")!;
    expect([row.accessToken, row.refreshToken, row.idToken]).toEqual([null, null, null]);
  });
});
