import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

/** The license is stated in five places (LICENSE, package.json, README, footer, Terms §8); this keeps them from drifting apart (ADR-041). */
describe("license statement", () => {
  it("is all rights reserved in the license file and in package.json", () => {
    expect(read("LICENSE")).toMatch(/^Copyright \(c\) \d{4} ASSERT Lab\. All rights reserved\./);
    expect((JSON.parse(read("package.json")) as { license?: string }).license).toBe("UNLICENSED");
  });
  it("is not described as MIT where users read it (footer, Terms)", () => {
    expect(read("src/components/site-footer.tsx")).toContain("Todos os direitos reservados");
    expect(read("src/components/site-footer.tsx")).not.toMatch(/licenciado sob MIT/i);
    expect(read("src/app/(legal)/termos/page.tsx")).not.toMatch(/licenciado sob MIT/i);
  });
});
