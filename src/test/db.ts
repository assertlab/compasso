import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";
import { users, workspaceMembers, workspaces } from "@/db/schema";

/** In-memory Postgres (WASM) with the real migrations applied: no network or secrets, so it runs in CI too. */
export async function createTestDb() {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/** A workspace with one member, as the Clerk sync would have created them. */
export async function seedWorkspace(db: TestDb, label: string) {
  const [workspace] = await db
    .insert(workspaces)
    .values({ clerkOrgId: `org_${label}`, name: `Workspace ${label}`, slug: `ws-${label}` })
    .returning();
  const [user] = await db
    .insert(users)
    .values({ clerkId: `user_${label}`, email: `${label}@example.com`, name: `User ${label}` })
    .returning();
  await db.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: user.id, role: "admin" });
  return { workspaceId: workspace.id, userId: user.id };
}
