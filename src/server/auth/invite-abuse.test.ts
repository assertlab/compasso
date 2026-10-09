import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { createTestDb, type TestDb } from "@/test/db";
import { createAuth } from "./auth";
import { getAuthEnv } from "./env";
import { INVITATION_SUBJECT, invitationText, plainName } from "./invite-mail";

describe("plainName / invitationText (COMP-004)", () => {
  it("flattens, drops links and phone-like numbers, and truncates", () => {
    expect(plainName("Seu acesso expira\nhoje http://evil.example/x ligue 0800 123 4567")).toBe("Seu acesso expira hoje ligue");
    expect(plainName("www.golpe.com Lab")).toBe("Lab");
    expect(plainName("Laboratório 2024")).toBe("Laboratório 2024");
    expect(plainName("a".repeat(200))).toHaveLength(60);
    expect(plainName(null)).toBe("");
  });

  it("never puts the names in the subject", () => {
    expect(INVITATION_SUBJECT).not.toMatch(/\$\{|convidou/);
    const body = invitationText({ inviter: "Ana", workspace: "Lab Recife", link: "https://x.test/accept-invitation/1" });
    expect(body).toContain('Ana convidou você para o workspace "Lab Recife"');
    expect(body).toContain("https://x.test/accept-invitation/1");
  });
});

describe("invitation and workspace caps", () => {
  let db: TestDb;
  let auth: ReturnType<typeof createAuth>;
  const mails: { to: string; subject: string; text: string }[] = [];

  beforeAll(async () => {
    db = await createTestDb();
    auth = createAuth({
      db: db as unknown as Db,
      nextJsCookies: false,
      env: getAuthEnv({ NODE_ENV: "test", BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123", BETTER_AUTH_URL: "http://localhost:3000" }),
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

  it("sends a fixed subject and a sanitized body, whatever the workspace is called", async () => {
    const headers = await signIn("spammer@example.com");
    const org = await auth.api.createOrganization({ headers, body: { name: "PREMIO http://golpe.example ligue 0800 123 4567", slug: "premio" } });
    mails.length = 0;
    await auth.api.createInvitation({ headers, body: { email: "target@example.com", role: "member", organizationId: org.id } });
    const mail = mails.at(-1)!;
    expect(mail.subject).toBe(INVITATION_SUBJECT);
    expect(mail.text).not.toContain("golpe.example");
    expect(mail.text).not.toContain("0800");
  });

  it("limits how many workspaces one person can be in", async () => {
    const headers = await signIn("many@example.com");
    for (let i = 0; i < 5; i++) await auth.api.createOrganization({ headers, body: { name: `Org ${i}`, slug: `many-${i}` } });
    await expect(auth.api.createOrganization({ headers, body: { name: "One too many", slug: "many-6" } })).rejects.toThrow();
  });

  it("limits pending invitations per workspace", async () => {
    const headers = await signIn("inviter@example.com");
    const org = await auth.api.createOrganization({ headers, body: { name: "Big", slug: "big" } });
    for (let i = 0; i < 20; i++) await auth.api.createInvitation({ headers, body: { email: `guest${i}@example.com`, role: "member", organizationId: org.id } });
    await expect(auth.api.createInvitation({ headers, body: { email: "guest20@example.com", role: "member", organizationId: org.id } })).rejects.toThrow();
  });
});
