import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { createTestDb, type TestDb } from "@/test/db";
import { createAuth } from "./auth";
import { getAuthEnv } from "./env";

/** COMP-012: pending invitations (e-mails of people who have not joined) are visible to owners and admins only. */
describe("pending invitation visibility", () => {
  let db: TestDb;
  let auth: ReturnType<typeof createAuth>;
  const mails: { text: string }[] = [];
  let ownerH: Headers;
  let adminH: Headers;
  let memberH: Headers;
  let orgId: string;

  beforeAll(async () => {
    db = await createTestDb();
    auth = createAuth({
      db: db as unknown as Db,
      nextJsCookies: false,
      env: getAuthEnv({ NODE_ENV: "test", BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123", BETTER_AUTH_URL: "http://localhost:3000" }),
      send: async (m) => void mails.push(m),
    });
    ownerH = await signIn("vis-owner@example.com");
    const org = await auth.api.createOrganization({ headers: ownerH, body: { name: "Vis", slug: "vis" } });
    orgId = org.id;
    const join = async (email: string, role: "member" | "admin") => {
      const inv = await auth.api.createInvitation({ headers: ownerH, body: { email, role, organizationId: orgId } });
      const headers = await signIn(email);
      await auth.api.acceptInvitation({ headers, body: { invitationId: inv.id } });
      await auth.api.setActiveOrganization({ headers, body: { organizationId: orgId } });
      return headers;
    };
    adminH = await join("vis-admin@example.com", "admin");
    memberH = await join("vis-member@example.com", "member");
    // a pending invitation nobody accepted
    await auth.api.createInvitation({ headers: ownerH, body: { email: "pending-secret@example.com", role: "member", organizationId: orgId } });
  });

  async function signIn(email: string) {
    mails.length = 0;
    await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
    await new Promise((r) => setTimeout(r, 20));
    const otp = /(\d{6})/.exec(mails[0].text)![1];
    const res = await auth.api.signInEmailOTP({ body: { email, otp }, returnHeaders: true });
    return new Headers({ cookie: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") });
  }

  const get = (path: string, headers: Headers) => auth.handler(new Request(`http://localhost:3000/api/auth${path}`, { headers: { cookie: headers.get("cookie")! } }));

  it("lets the owner and an admin list pending invitations", async () => {
    for (const h of [ownerH, adminH]) {
      const res = await get("/organization/list-invitations", h);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("pending-secret@example.com");
    }
  });

  it("refuses list-invitations to a plain member, by session, id and over HTTP", async () => {
    await expect(auth.api.listInvitations({ headers: memberH })).rejects.toThrow();
    await expect(auth.api.listInvitations({ headers: memberH, query: { organizationId: orgId } })).rejects.toThrow();
    const res = await get("/organization/list-invitations", memberH);
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain("pending-secret@example.com");
  });

  it("refuses get-full-organization to a plain member (it embeds the invitations), including by slug", async () => {
    for (const path of ["/organization/get-full-organization", "/organization/get-full-organization?organizationSlug=vis", `/organization/get-full-organization?organizationId=${orgId}`]) {
      const res = await get(path, memberH);
      expect(res.status).toBe(403);
      expect(await res.text()).not.toContain("pending-secret@example.com");
    }
  });

  it("still serves get-full-organization to admins and the organization list to members", async () => {
    const full = await get("/organization/get-full-organization", adminH);
    expect(full.status).toBe(200);
    expect(await full.text()).toContain("pending-secret@example.com");
    const list = await get("/organization/list", memberH);
    expect(list.status).toBe(200);
    expect(await list.text()).toContain("Vis");
  });

  it("leaves the 401 to the endpoint when there is no session", async () => {
    const res = await auth.handler(new Request("http://localhost:3000/api/auth/organization/list-invitations"));
    expect(res.status).toBe(401);
  });

  it("refuses a member of another workspace who tries this one's id", async () => {
    const outsider = await signIn("vis-outsider@example.com");
    const own = await auth.api.createOrganization({ headers: outsider, body: { name: "Other", slug: "vis-other" } });
    expect(own.id).not.toBe(orgId);
    const res = await get(`/organization/list-invitations?organizationId=${orgId}`, outsider);
    expect(res.status).toBe(403);
  });
});
