/**
 * Copies Clerk-era people/workspaces/memberships into Better Auth (ADR-033).
 *   npx tsx --env-file=.env.local scripts/migrate-clerk-to-auth.ts           # dry-run (default)
 *   npx tsx --env-file=.env.local scripts/migrate-clerk-to-auth.ts --apply   # writes
 * Prints only the database host, never the connection string.
 */
import { getDb } from "@/db";
import { getEnv } from "@/env";
import { migrateClerkToAuth } from "@/server/auth/migrate-from-clerk";

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`Database host: ${new URL(getEnv().DATABASE_URL).host}`);
  console.log(apply ? "Mode: APPLY (writes)" : "Mode: dry-run (nothing is written; pass --apply to write)");
  const report = await migrateClerkToAuth(getDb(), { apply });
  console.log(JSON.stringify(report, null, 2));
  if (apply && report.orphans > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
