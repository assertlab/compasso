import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-origin paths and queries", () => {
    expect(safeNext("/relatorios?mes=2026-10")).toBe("/relatorios?mes=2026-10");
    expect(safeNext("/accept-invitation/abc")).toBe("/accept-invitation/abc");
  });
  it("falls back for anything that could leave the site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", "", null, undefined]) {
      expect(safeNext(bad as string | null | undefined)).toBe("/");
    }
  });
  it("uses the given fallback", () => {
    expect(safeNext("https://x.com", "/painel")).toBe("/painel");
  });
});
