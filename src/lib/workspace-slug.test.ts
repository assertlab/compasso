import { describe, expect, it } from "vitest";
import { workspaceSlug } from "./workspace-slug";

describe("workspaceSlug", () => {
  it("slugifies the name and appends the suffix", () => {
    expect(workspaceSlug("Minha Consultoria Ltda.", "abc123")).toBe("minha-consultoria-ltda-abc123");
  });
  it("is unique per call by default", () => {
    expect(workspaceSlug("Acme")).not.toBe(workspaceSlug("Acme"));
  });
  it("copes with names without letters", () => {
    expect(workspaceSlug("###", "x1")).toBe("workspace-x1");
  });
});
