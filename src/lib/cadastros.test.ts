import { describe, expect, it } from "vitest";
import { parseTab } from "./cadastros";

describe("parseTab", () => {
  it("accepts known tabs", () => {
    expect(parseTab("projetos")).toBe("projetos");
    expect(parseTab("tags")).toBe("tags");
  });
  it("falls back to organizations for missing or unknown values", () => {
    expect(parseTab(undefined)).toBe("organizacoes");
    expect(parseTab("x")).toBe("organizacoes");
    expect(parseTab(["tags", "projetos"])).toBe("tags");
    expect(parseTab([])).toBe("organizacoes");
  });
});
