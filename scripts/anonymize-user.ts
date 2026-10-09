/**
 * LGPD erasure of one person (ADR-034).
 *   npx tsx --env-file=.env.local scripts/anonymize-user.ts --email someone@example.com           # dry-run (default)
 *   npx tsx --env-file=.env.local scripts/anonymize-user.ts --email someone@example.com --apply   # irreversible
 * Prints only the database host, never the connection string. For production pass DATABASE_URL inline (see the PR).
 */
import { isNull, and, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getEnv } from "@/env";
import { anonymizeAccount, planAnonymization } from "@/server/auth/anonymize";

async function main() {
  const i = process.argv.indexOf("--email");
  const email = (i >= 0 ? process.argv[i + 1] : undefined)?.trim().toLowerCase();
  const apply = process.argv.includes("--apply");
  if (!email) throw new Error("Usage: anonymize-user.ts --email <e-mail> [--apply]");

  const db = getDb();
  console.log(`Database host: ${new URL(getEnv().DATABASE_URL).host}`);
  console.log(apply ? "Mode: APPLY (irreversible)" : "Mode: dry-run (nothing is written; pass --apply to write)");

  const [user] = await db.select({ id: users.id }).from(users).where(and(sql`lower(${users.email}) = ${email}`, isNull(users.deletedAt)));
  if (!user) throw new Error(`No active user with e-mail ${email}`);

  const plan = await planAnonymization(db, user.id);
  console.log(JSON.stringify(plan, null, 2));
  if (!apply) return;
  console.log(JSON.stringify(await anonymizeAccount(db, user.id), null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
