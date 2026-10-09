import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Plain service worker script served as-is
    "public/sw.js",
  ]),
  // ADR-026: pages, components and libs reach the database only through src/server (the tenant layer). Type-only imports are fine.
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/db", "@/db/*", "**/db", "**/db/*"], // relative paths too: "../../db" must not escape the rule
              allowTypeImports: true,
              message: "Do not import the database outside src/server: go through getTenant() / createTenant() (ADR-026).",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
