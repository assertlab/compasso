/**
 * Closed-beta allow list (ADR-038).
 *   npx tsx --env-file=.env.local scripts/access.ts list
 *   npx tsx --env-file=.env.local scripts/access.ts add someone@example.com "nota opcional"
 *   npx tsx --env-file=.env.local scripts/access.ts remove someone@example.com
 * Removing an address does not touch an account that already exists. Prints only the database host. For production pass
 * DATABASE_URL inline (see the PR).
 */
import { getDb } from "@/db";
import { getEnv } from "@/env";
import { allowEmail, disallowEmail, listAllowedEmails } from "@/server/auth/access";

async function main() {
  const [command, email, ...note] = process.argv.slice(2);
  const db = getDb();
  console.log(`Database host: ${new URL(getEnv().DATABASE_URL).host}`);

  if (command === "list") {
    const rows = await listAllowedEmails(db);
    for (const r of rows) console.log(`${r.email}\t${r.createdAt.toISOString()}\t${r.note ?? ""}`);
    console.log(`${rows.length} address(es)`);
  } else if (command === "add" && email?.includes("@")) {
    console.log(`Allowed: ${await allowEmail(db, email, note.join(" "))}`);
  } else if (command === "remove" && email) {
    console.log((await disallowEmail(db, email)) ? `Removed: ${email.trim().toLowerCase()}` : `Not on the list: ${email}`);
  } else {
    throw new Error("Usage: access.ts list | add <e-mail> [note] | remove <e-mail>");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
