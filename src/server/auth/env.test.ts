import { describe, expect, it } from "vitest";
import { getAuthEnv } from "./env";

const secret = "x".repeat(32);

describe("getAuthEnv", () => {
  it("defaults the URL outside production and does not require a secret", () => {
    expect(getAuthEnv({ NODE_ENV: "development" }).BETTER_AUTH_URL).toBe("http://localhost:3000");
  });
  it("requires secret and URL in production", () => {
    expect(() => getAuthEnv({ NODE_ENV: "production" })).toThrow(/required in production/);
    expect(() => getAuthEnv({ NODE_ENV: "production", BETTER_AUTH_SECRET: secret })).toThrow();
    expect(getAuthEnv({ NODE_ENV: "production", BETTER_AUTH_SECRET: secret, BETTER_AUTH_URL: "https://app.example.com" }).BETTER_AUTH_URL).toBe("https://app.example.com");
  });
  it("derives the URL of a Vercel preview from the branch URL, but never overrides an explicit one", () => {
    const preview = { NODE_ENV: "production", BETTER_AUTH_SECRET: secret, VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "compasso-git-x.vercel.app" };
    expect(getAuthEnv(preview).BETTER_AUTH_URL).toBe("https://compasso-git-x.vercel.app");
    expect(getAuthEnv({ ...preview, BETTER_AUTH_URL: "https://custom.example.com" }).BETTER_AUTH_URL).toBe("https://custom.example.com");
    expect(() => getAuthEnv({ ...preview, VERCEL_ENV: "production" })).toThrow(/required in production/);
  });
  it("rejects a short secret", () => {
    expect(() => getAuthEnv({ BETTER_AUTH_SECRET: "short" })).toThrow();
  });
  it("requires the two Turnstile keys together", () => {
    expect(() => getAuthEnv({ BETTER_AUTH_SECRET: secret, TURNSTILE_SITE_KEY: "site" })).toThrow(/together/);
    expect(() => getAuthEnv({ BETTER_AUTH_SECRET: secret, TURNSTILE_SECRET_KEY: "secret" })).toThrow(/together/);
    expect(getAuthEnv({ BETTER_AUTH_SECRET: secret, TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" }).TURNSTILE_SITE_KEY).toBe("site");
    expect(getAuthEnv({ BETTER_AUTH_SECRET: secret }).TURNSTILE_SITE_KEY).toBeUndefined();
  });
  it("requires Turnstile on Vercel production only", () => {
    const base = { NODE_ENV: "production", BETTER_AUTH_SECRET: secret, BETTER_AUTH_URL: "https://app.example.com" };
    expect(() => getAuthEnv({ ...base, VERCEL_ENV: "production" })).toThrow(/required in Vercel production/);
    expect(getAuthEnv({ ...base, VERCEL_ENV: "production", TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret", ACCESS_MODE: "closed" }).TURNSTILE_SITE_KEY).toBe("site");
    // Preview deployments and plain production builds (CI) keep the challenge optional.
    expect(getAuthEnv({ ...base, VERCEL_ENV: "preview" }).TURNSTILE_SITE_KEY).toBeUndefined();
    expect(getAuthEnv(base).TURNSTILE_SITE_KEY).toBeUndefined();
  });
  it("defaults ACCESS_MODE to open, and requires an explicit one on Vercel production", () => {
    expect(getAuthEnv({ BETTER_AUTH_SECRET: secret }).ACCESS_MODE).toBe("open");
    expect(getAuthEnv({ BETTER_AUTH_SECRET: secret, ACCESS_MODE: "closed" }).ACCESS_MODE).toBe("closed");
    expect(() => getAuthEnv({ BETTER_AUTH_SECRET: secret, ACCESS_MODE: "invite" })).toThrow();
    const prod = { NODE_ENV: "production", BETTER_AUTH_SECRET: secret, BETTER_AUTH_URL: "https://app.example.com", VERCEL_ENV: "production", TURNSTILE_SITE_KEY: "s", TURNSTILE_SECRET_KEY: "k" };
    expect(() => getAuthEnv(prod)).toThrow(/ACCESS_MODE/);
    expect(getAuthEnv({ ...prod, ACCESS_MODE: "closed" }).ACCESS_MODE).toBe("closed");
  });
});
