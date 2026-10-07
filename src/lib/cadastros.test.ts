import { describe, expect, it } from "vitest";
import { parseTab, tabsFor } from "./cadastros";

describe("parseTab", () => {
  it("accepts known tabs", () => {
    expect(parseTab("projetos")).toBe("projetos");
    expect(parseTab("tags")).toBe("tags");
  });
  it("falls back to organizations for missing or unknown values", () => {
    expect(parseTab(undefined)).toBe("clientes");
    expect(parseTab("x")).toBe("clientes");
    expect(parseTab(["tags", "projetos"])).toBe("tags");
    expect(parseTab([])).toBe("clientes");
  });

  it("hides the members tab from non-admins", () => {
    expect(tabsFor(false).map((t) => t.key)).toEqual(["clientes", "projetos", "tags"]);
    expect(tabsFor(true).map((t) => t.key)).toContain("membros");
    expect(parseTab("membros")).toBe("clientes");
    expect(parseTab("membros", false)).toBe("clientes");
    expect(parseTab("membros", true)).toBe("membros");
  });
});
