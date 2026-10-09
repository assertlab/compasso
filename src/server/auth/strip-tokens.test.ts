import { describe, expect, it } from "vitest";
import { stripProviderTokens } from "./strip-tokens";

describe("stripProviderTokens", () => {
  it("nulls provider tokens and keeps identity fields", () => {
    const out = stripProviderTokens({
      providerId: "google",
      accountId: "123",
      accessToken: "a",
      refreshToken: "r",
      idToken: "i",
      accessTokenExpiresAt: new Date(),
      scope: "email",
    });
    expect(out).toMatchObject({ providerId: "google", accountId: "123", scope: "email", accessToken: null, refreshToken: null, idToken: null, accessTokenExpiresAt: null });
  });

  it("does not add fields that were not there", () => {
    expect("accessToken" in stripProviderTokens({ providerId: "x" })).toBe(false);
  });
});
