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
});
