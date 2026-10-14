import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { createTestDb, type TestDb } from "@/test/db";
import { allowEmail, disallowEmail, listAllowedEmails, mayCreateAccount } from "./access";
import { createAuth } from "./auth";
import { getAuthEnv } from "./env";

describe("closed-beta gate (ADR-038)", () => {
  let db: TestDb;
  const asDb = () => db as unknown as Db;
  const mails: { to: string; text: string }[] = [];
  const envFor = (ACCESS_MODE: "open" | "closed") => getAuthEnv({ NODE_ENV: "test", BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123", ACCESS_MODE });
  const authIn = (mode: "open" | "closed") => createAuth({ db: asDb(), nextJsCookies: false, env: envFor(mode), send: async (m) => void mails.push(m) });
  const wait = () => new Promise((r) => setTimeout(r, 20));

  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(async () => {
    await db.$client.close();
  });

  it("open mode lets anyone in", async () => {
    expect(await mayCreateAccount(asDb(), "open", "anyone@example.com")).toBe(true);
  });

  it("closed mode refuses an unknown address and accepts an allow-listed one, whatever the case", async () => {
    expect(await mayCreateAccount(asDb(), "closed", "stranger@example.com")).toBe(false);
    await allowEmail(asDb(), "  Friend@Example.com ", "colega");
    expect(await mayCreateAccount(asDb(), "closed", "friend@example.com")).toBe(true);
    expect(await mayCreateAccount(asDb(), "closed", "FRIEND@EXAMPLE.COM")).toBe(true);
    expect((await listAllowedEmails(asDb())).map((r) => r.email)).toContain("friend@example.com");
  });

  it("allowing twice is harmless and removing takes the access away", async () => {
    await allowEmail(asDb(), "twice@example.com");
    await allowEmail(asDb(), "twice@example.com");
    expect((await listAllowedEmails(asDb())).filter((r) => r.email === "twice@example.com")).toHaveLength(1);
    expect(await disallowEmail(asDb(), "twice@example.com")).toBe(true);
    expect(await disallowEmail(asDb(), "twice@example.com")).toBe(false);
    expect(await mayCreateAccount(asDb(), "closed", "twice@example.com")).toBe(false);
  });

  it("closed mode lets people with an account keep signing in", async () => {
    await db.insert(authSchema.user).values({ id: "u-existing", name: "Existing", email: "Existing@Example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
    expect(await mayCreateAccount(asDb(), "closed", "existing@example.com")).toBe(true);
  });

  it("a pending invitation is access, an expired or accepted one is not", async () => {
    const now = new Date("2026-10-14T12:00:00Z");
    await db.insert(authSchema.user).values({ id: "u-inviter", name: "Inviter", email: "inviter@example.com", emailVerified: true, createdAt: now, updatedAt: now });
    await db.insert(authSchema.organization).values({ id: "o-1", name: "Lab", slug: "lab-gate", createdAt: now });
    const base = { organizationId: "o-1", inviterId: "u-inviter", role: "member", createdAt: now };
    await db.insert(authSchema.invitation).values([
      { ...base, id: "i-pending", email: "Pending@example.com", status: "pending", expiresAt: new Date("2026-10-16T12:00:00Z") },
      { ...base, id: "i-expired", email: "expired@example.com", status: "pending", expiresAt: new Date("2026-10-13T12:00:00Z") },
      { ...base, id: "i-accepted", email: "accepted@example.com", status: "accepted", expiresAt: new Date("2026-10-16T12:00:00Z") },
    ]);
    expect(await mayCreateAccount(asDb(), "closed", "pending@example.com", now)).toBe(true);
    expect(await mayCreateAccount(asDb(), "closed", "expired@example.com", now)).toBe(false);
    expect(await mayCreateAccount(asDb(), "closed", "accepted@example.com", now)).toBe(false);
  });

  it("the code request is refused for a stranger with ACCESS_RESTRICTED and no e-mail is sent", async () => {
    mails.length = 0;
    const auth = authIn("closed");
    const err = await auth.api.sendVerificationOTP({ body: { email: "nobody@example.com", type: "sign-in" } }).catch((e: unknown) => e);
    expect(err).toMatchObject({ body: { code: "ACCESS_RESTRICTED" } });
    await wait();
    expect(mails).toHaveLength(0);
  });

  it("the code request works for an allow-listed address, and the full sign-in creates the account", async () => {
    mails.length = 0;
    await allowEmail(asDb(), "ok@example.com");
    const auth = authIn("closed");
    await auth.api.sendVerificationOTP({ body: { email: "ok@example.com", type: "sign-in" } });
    await wait();
    expect(mails).toHaveLength(1);
    const otp = /(\d{6})/.exec(mails[0].text)![1];
    const res = await auth.api.signInEmailOTP({ body: { email: "ok@example.com", otp } });
    expect(res.user.email).toBe("ok@example.com");
  });

  it("in open mode the same stranger gets a code", async () => {
    mails.length = 0;
    await authIn("open").api.sendVerificationOTP({ body: { email: "stranger2@example.com", type: "sign-in" } });
    await wait();
    expect(mails).toHaveLength(1);
  });

  it("account creation itself is refused for a stranger (covers social sign-in), even with a valid verified profile", async () => {
    const auth = authIn("closed");
    const ctx = await auth.$context;
    const created = await ctx.internalAdapter.createUser({ email: "social-stranger@example.com", name: "S", emailVerified: true }, { method: "email-otp" }).catch(() => null);
    expect(created).toBeFalsy();
    await allowEmail(asDb(), "social-ok@example.com");
    const ok = await ctx.internalAdapter.createUser({ email: "social-ok@example.com", name: "S", emailVerified: true }, { method: "email-otp" });
    expect(ok.email).toBe("social-ok@example.com");
  });
});
