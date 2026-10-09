import { describe, expect, it } from "vitest";
import { formatVersion } from "./app-info";

describe("formatVersion", () => {
  it("shows only the version in production", () => {
    expect(formatVersion({ version: "0.1.0", vercelEnv: "production", sha: "8c1652e9f" })).toBe("v0.1.0");
  });
  it("adds the short commit in previews", () => {
    expect(formatVersion({ version: "0.1.0", vercelEnv: "preview", sha: "8c1652e9f0aa" })).toBe("v0.1.0 · 8c1652e");
  });
  it("marks local runs as dev", () => {
    expect(formatVersion({ version: "0.1.0" })).toBe("v0.1.0 · dev");
  });
});
