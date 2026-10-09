import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as authSchema from "@/db/auth-schema";
import type { Db } from "@/db";
import { createTestDb, type TestDb } from "@/test/db";
import { createAuth } from "./auth";
import { getAuthEnv } from "./env";
import { consumeOtpQuota, OTP_EMAIL_LIMITS } from "./otp-limit";

/** Security audit 2026-10 (COMP-001, 002, 005): regressions for the authentication hardening. */
describe("auth hardening", () => {
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

  const githubSource = { method: "oauth", oauth: { providerId: "github" } } as const;
  const request = (email: string) => auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });

  it("caps sign-in codes per e-mail, not only per IP", async () => {
    const hourly = OTP_EMAIL_LIMITS[0].max;
    for (let i = 0; i < hourly; i++) await request("target@example.com");
    await expect(request("target@example.com")).rejects.toThrow(/Muitos códigos/);
    // the cap is per address and case-insensitive
    await expect(request("  TARGET@example.com ")).rejects.toThrow(/Muitos códigos/);
    await expect(request("someone-else@example.com")).resolves.toBeDefined();
  });

  it("a refused request leaves the valid code untouched", async () => {
    mails.length = 0;
    const hourly = OTP_EMAIL_LIMITS[0].max;
    for (let i = 0; i < hourly; i++) await request("rotate@example.com");
    await new Promise((r) => setTimeout(r, 20));
    const otp = /(\d{6})/.exec(mails.at(-1)!.text)![1];
    await expect(request("rotate@example.com")).rejects.toThrow();
    const res = await auth.api.signInEmailOTP({ body: { email: "rotate@example.com", otp } });
    expect(res.user.email).toBe("rotate@example.com");
  });

  it("opens a new window after the old one expires", async () => {
    const t0 = 1_800_000_000_000;
    const [{ max, windowMs }] = OTP_EMAIL_LIMITS;
    for (let i = 0; i < max; i++) expect(await consumeOtpQuota(db as unknown as Db, "window@example.com", t0)).toBe(true);
    expect(await consumeOtpQuota(db as unknown as Db, "window@example.com", t0 + 1000)).toBe(false);
    expect(await consumeOtpQuota(db as unknown as Db, "window@example.com", t0 + windowMs + 1)).toBe(true);
  });

  it("keeps only a hash of the address in the counters", async () => {
    await consumeOtpQuota(db as unknown as Db, "private@example.com");
    const keys = (await db.select().from(authSchema.rateLimit)).map((r) => r.key);
    expect(keys.some((k) => k.startsWith("otp-email:"))).toBe(true);
    expect(keys.join(" ")).not.toContain("private@example.com");
  });

  it("stores the one-time code hashed, not in plain text", async () => {
    mails.length = 0;
    await request("hashed@example.com");
    await new Promise((r) => setTimeout(r, 20));
    const otp = /(\d{6})/.exec(mails[0].text)![1];
    const rows = await db.select().from(authSchema.verification).where(eq(authSchema.verification.identifier, "sign-in-otp-hashed@example.com"));
    expect(rows).toHaveLength(1);
    expect(rows[0].value).not.toContain(otp);
  });

  it("refuses to create a user whose e-mail the provider did not verify (pre-account takeover)", async () => {
    const ctx = await auth.$context;
    // what the social callback does for a first-time GitHub/Google sign-in with an unverified address
    // (the hook aborts the insert, createUser returns null and the callback then fails with "unable to create user")
    expect(await ctx.internalAdapter.createUser({ email: "victim@example.com", name: "Mallory", emailVerified: false }, githubSource)).toBeNull();
    expect(await db.select().from(authSchema.user).where(eq(authSchema.user.email, "victim@example.com"))).toHaveLength(0);

    // the real owner signs in by e-mail code and ends up with a clean account: no social account hanging off it
    mails.length = 0;
    await request("victim@example.com");
    await new Promise((r) => setTimeout(r, 20));
    const otp = /(\d{6})/.exec(mails[0].text)![1];
    const res = await auth.api.signInEmailOTP({ body: { email: "victim@example.com", otp } });
    const accounts = await db.select().from(authSchema.account).where(eq(authSchema.account.userId, res.user.id));
    expect(accounts.filter((a) => a.providerId !== "credential")).toHaveLength(0);
  });

  it("still creates verified users (provider-verified social sign-in)", async () => {
    const ctx = await auth.$context;
    const created = await ctx.internalAdapter.createUser({ email: "ok@example.com", name: "Ok", emailVerified: true }, githubSource);
    expect(created.emailVerified).toBe(true);
  });
});

/** Second audit (COMP-013): the OTP plugin's password-reset and e-mail-change routes are closed over HTTP. */
describe("unused OTP routes (COMP-013)", () => {
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
    // a registered address: the routes must stay shut for it, not only for strangers
    await auth.api.sendVerificationOTP({ body: { email: "registered@example.com", type: "sign-in" } });
    await new Promise((r) => setTimeout(r, 20));
    const otp = /(\d{6})/.exec(mails[0].text)![1];
    await auth.api.signInEmailOTP({ body: { email: "registered@example.com", otp } });
  });

  const post = (path: string, body: unknown) =>
    auth.handler(
      new Request(`http://localhost:3000/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify(body),
      }),
    );

  it.each([
    "/email-otp/request-password-reset",
    "/forget-password/email-otp",
    "/email-otp/reset-password",
    "/email-otp/request-email-change",
    "/email-otp/change-email",
  ])("answers 404 on %s and sends nothing", async (path) => {
    mails.length = 0;
    const res = await post(path, { email: "registered@example.com", otp: "123456", password: "Sup3rSecret!pw", newEmail: "x@example.com" });
    expect(res.status).toBe(404);
    await new Promise((r) => setTimeout(r, 20));
    expect(mails).toHaveLength(0);
  });

  it("still serves the sign-in code route over HTTP", async () => {
    mails.length = 0;
    const res = await post("/email-otp/send-verification-otp", { email: "registered@example.com", type: "sign-in" });
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 20));
    expect(mails).toHaveLength(1);
  });

  it("never mails a code for a flow other than sign-in", async () => {
    mails.length = 0;
    for (const type of ["forget-password", "email-verification", "change-email"] as const) {
      await auth.api.sendVerificationOTP({ body: { email: "registered@example.com", type } }).catch(() => undefined);
    }
    await new Promise((r) => setTimeout(r, 20));
    expect(mails).toHaveLength(0);
  });
});
