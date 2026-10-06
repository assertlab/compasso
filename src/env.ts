import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validates process.env once, lazily, so `next build` does not need secrets. */
export function getEnv(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        `Invalid environment variables: ${JSON.stringify(z.flattenError(parsed.error).fieldErrors)}`,
      );
    }
    cached = parsed.data;
  }
  return cached;
}
