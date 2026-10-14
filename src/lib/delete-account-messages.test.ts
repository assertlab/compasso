import { describe, expect, it } from "vitest";
import { codeRefusalMessage, deletionRefusalMessage } from "./delete-account-messages";

describe("delete-account messages", () => {
  it("names the workspaces that block the deletion", () => {
    expect(codeRefusalMessage({ ok: false, reason: "blocked", workspaces: ["Lab A", "Lab B"] })).toContain('"Lab A", "Lab B"');
    expect(deletionRefusalMessage({ ok: false, reason: "blocked", workspaces: ["Lab A"] })).toContain('"Lab A"');
  });
  it("rounds the wait up to whole minutes and never says 0", () => {
    expect(codeRefusalMessage({ ok: false, reason: "rate-limited", retryAfterSeconds: 61 })).toContain("2 min");
    expect(codeRefusalMessage({ ok: false, reason: "rate-limited", retryAfterSeconds: 1 })).toContain("1 min");
  });
  it("has a message for every refusal", () => {
    for (const reason of ["wrong-confirmation", "wrong-code", "expired", "too-many-attempts", "no-code", "not-found"] as const) {
      expect(deletionRefusalMessage({ ok: false, reason }).length).toBeGreaterThan(5);
    }
  });
});
