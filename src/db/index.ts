import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getEnv } from "@/env";
import * as schema from "./schema";

function create() {
  return drizzle(neon(getEnv().DATABASE_URL), { schema });
}

let instance: ReturnType<typeof create> | undefined;

/**
 * Lazy singleton. Note: the neon-http driver is stateless and does not support
 * interactive transactions; switch to neon-serverless (WebSocket Pool) when a
 * flow needs them (decide in the tenant-layer step).
 */
export function getDb() {
  return (instance ??= create());
}

export type Db = ReturnType<typeof getDb>;
export { schema };
