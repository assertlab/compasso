/**
 * Fictional data (3 clients, 5 projects, ~60 days of time entries) for manual testing.
 *   npx tsx scripts/seed-demo.ts --email vinicius3w@gmail.com --workspace "ASSERT Lab"            # dry-run (default)
 *   npx tsx scripts/seed-demo.ts --email vinicius3w@gmail.com --workspace "ASSERT Lab" --apply     # writes
 * The database comes from DATABASE_URL (use `read -s` to pass production's, see the PR). Idempotent: a workspace that
 * already has the "demo" tag is skipped. Prints only the database host, never the connection string.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users, workspaceMembers, workspaces } from "@/db/schema";
import { getEnv } from "@/env";
import { seedDemo } from "@/server/seed-demo";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const workspaceName = arg("workspace")?.trim();
  const apply = process.argv.includes("--apply");
  if (!email || !workspaceName) throw new Error('Usage: seed-demo.ts --email <e-mail> --workspace "<name>" [--apply]');

  const db = getDb();
  console.log(`Database host: ${new URL(getEnv().DATABASE_URL).host}`);
  console.log(apply ? "Mode: APPLY (writes)" : "Mode: dry-run (nothing is written; pass --apply to write)");

  const [user] = await db.select().from(users).where(and(sql`lower(${users.email}) = ${email}`, isNull(users.deletedAt)));
  if (!user) throw new Error(`No active user with e-mail ${email}`);
  const matches = await db
    .select({ id: workspaces.id, name: workspaces.name, timezone: users.timezone })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(eq(users.id, user.id), isNull(workspaceMembers.removedAt), isNull(workspaces.archivedAt), sql`lower(${workspaces.name}) = ${workspaceName.toLowerCase()}`));
  if (matches.length !== 1) throw new Error(`Expected exactly one workspace named "${workspaceName}" for ${email}, found ${matches.length}`);

  const result = await seedDemo(db, { workspaceId: matches[0].id, userId: user.id, timezone: matches[0].timezone, apply });
  console.log(JSON.stringify({ workspace: matches[0].name, user: email, ...result }, null, 2));
  if (result.skipped) console.log('Skipped: this workspace already has the "demo" tag.');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
