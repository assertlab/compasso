import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

/** COMP-009: pages, components and libs must not reach the database directly, by alias or by relative path (ADR-026). */
describe("database import boundary (eslint)", () => {
  const eslint = new ESLint({ cwd: process.cwd() });
  const lint = async (filePath: string, code: string) => (await eslint.lintText(code, { filePath })).flatMap((r) => r.messages.filter((m) => m.ruleId === "@typescript-eslint/no-restricted-imports"));

  it.each([
    ["src/app/probe.ts", 'import { getDb } from "@/db";\nexport const x = getDb;\n'],
    ["src/app/x/probe.ts", 'import { getDb } from "../../db";\nexport const x = getDb;\n'],
    ["src/components/probe.ts", 'import { users } from "@/db/schema";\nexport const x = users;\n'],
    ["src/lib/probe.ts", 'import { getDb } from "../db/index";\nexport const x = getDb;\n'],
  ])("rejects a runtime import in %s", async (file, code) => {
    expect(await lint(file, code)).not.toHaveLength(0);
  }, 30_000);

  it("allows type-only imports and the server layer", async () => {
    expect(await lint("src/app/probe.ts", 'import type { Db } from "@/db";\nexport type X = Db;\n')).toHaveLength(0);
    expect(await lint("src/server/probe.ts", 'import { getDb } from "@/db";\nexport const x = getDb;\n')).toHaveLength(0);
  }, 30_000);
});
