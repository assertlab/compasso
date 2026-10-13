import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { like } from "drizzle-orm";
import * as authSchema from "@/db/auth-schema";
import type { Db } from "@/db";
import { TURNSTILE_ACTION, TURNSTILE_HEADER } from "@/lib/turnstile";
import { createTestDb, type TestDb } from "@/test/db";
import { createAuth } from "./auth";
import { getAuthEnv } from "./env";

const base = { NODE_ENV: "test", BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123", BETTER_AUTH_URL: "http://localhost:3000" };
type Verdict = { success: boolean; action?: string; hostname?: string } | "unreachable";

/** COMP-014: the sign-in code request needs a valid Turnstile token, so a script cannot burn a victim's per-address quota. */
describe("Turnstile on the sign-in code request", () => {
  let db: TestDb;
  let guarded: ReturnType<typeof createAuth>;
  let open: ReturnType<typeof createAuth>;
  const mails: { to: string; subject: string; text: string }[] = [];
  let verdict: Verdict = { success: true, action: TURNSTILE_ACTION, hostname: "localhost" };
  let siteverifyCalls = 0;
  let ipCounter = 0;

  const make = (extra: Record<string, string>) =>
    createAuth({ db: db as unknown as Db, nextJsCookies: false, env: getAuthEnv({ ...base, ...extra }), send: async (m) => void mails.push(m) });

  beforeAll(async () => {
    db = await createTestDb();
    guarded = make({ TURNSTILE_SITE_KEY: "site-key", TURNSTILE_SECRET_KEY: "secret-key" });
    open = make({});
  });

  beforeEach(() => {
    mails.length = 0;
    siteverifyCalls = 0;
    verdict = { success: true, action: TURNSTILE_ACTION, hostname: "localhost" };
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.startsWith("https://challenges.cloudflare.com/turnstile/v0/siteverify")) return realFetch(input, init);
      siteverifyCalls++;
      if (verdict === "unreachable") throw new TypeError("network down");
      return new Response(JSON.stringify(verdict), { status: 200, headers: { "content-type": "application/json" } });
    });
  });
  afterEach(() => vi.restoreAllMocks());

  const send = (auth: ReturnType<typeof createAuth>, email: string, token?: string) =>
    auth.handler(
      new Request("http://localhost:3000/api/auth/email-otp/send-verification-otp", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": `203.0.113.${(++ipCounter % 250) + 1}`, ...(token ? { [TURNSTILE_HEADER]: token } : {}) },
        body: JSON.stringify({ email, type: "sign-in" }),
      }),
    );
  const tick = () => new Promise((r) => setTimeout(r, 20));
  const quotaRows = async () => (await db.select().from(authSchema.rateLimit).where(like(authSchema.rateLimit.key, "otp-email:%"))).length;

  it("refuses a request without a token and sends nothing", async () => {
    const res = await send(guarded, "a@example.com");
    expect(res.status).toBe(400);
    await tick();
    expect(mails).toHaveLength(0);
    expect(siteverifyCalls).toBe(0);
  });

  it("sends the code when Cloudflare accepts the token", async () => {
    const res = await send(guarded, "b@example.com", "good-token");
    expect(res.status).toBe(200);
    await tick();
    expect(mails).toHaveLength(1);
    expect(siteverifyCalls).toBe(1);
  });

  it.each<[string, Verdict]>([
    ["a rejected token", { success: false }],
    ["a token minted for another action", { success: true, action: "login", hostname: "localhost" }],
    ["a token minted for another site", { success: true, action: TURNSTILE_ACTION, hostname: "evil.example" }],
  ])("refuses %s", async (_name, v) => {
    verdict = v;
    const res = await send(guarded, "c@example.com", "bad-token");
    expect(res.status).toBe(403);
    await tick();
    expect(mails).toHaveLength(0);
  });

  it("fails closed when Cloudflare cannot be reached", async () => {
    verdict = "unreachable";
    const res = await send(guarded, "d@example.com", "any-token");
    expect(res.status).toBeGreaterThanOrEqual(400);
    await tick();
    expect(mails).toHaveLength(0);
  });

  it("does not let a script without a token burn a victim's quota (COMP-014)", async () => {
    const before = await quotaRows();
    for (let i = 0; i < 25; i++) expect((await send(guarded, "victim@example.com")).status).toBe(400);
    expect(await quotaRows()).toBe(before); // refused before the per-address counter
    const res = await send(guarded, "victim@example.com", "good-token");
    expect(res.status).toBe(200);
    await tick();
    expect(mails).toHaveLength(1);
  });

  it("still applies the per-address quota to requests that pass the challenge", async () => {
    let last = 200;
    for (let i = 0; i < 6; i++) last = (await send(guarded, "burst@example.com", "good-token")).status;
    expect(last).toBe(429);
  });

  it("leaves the code route open when no keys are configured (local development, Preview)", async () => {
    const res = await send(open, "e@example.com");
    expect(res.status).toBe(200);
    expect(siteverifyCalls).toBe(0);
  });

  it("does not ask for a token on the verification step", async () => {
    const res = await guarded.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email-otp", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "f@example.com", otp: "000000" }),
      }),
    );
    expect(await res.text()).not.toContain("Missing CAPTCHA response");
  });
});
