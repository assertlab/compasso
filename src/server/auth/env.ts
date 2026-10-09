import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(3).optional(),
  VERCEL_ENV: z.string().optional(),
  VERCEL_BRANCH_URL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
});

export type AuthEnv = z.infer<typeof schema> & { BETTER_AUTH_URL: string };

/**
 * Kept apart from `getEnv()` (database only) so tooling that just needs the DB does not require auth variables.
 * In production the secret and the public URL are mandatory.
 */
export function getAuthEnv(source: Record<string, string | undefined> = process.env): AuthEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid auth environment variables: ${JSON.stringify(z.flattenError(parsed.error).fieldErrors)}`);
  }
  const env = parsed.data;
  // Preview deployments have one URL per branch: derive it so no variable has to be kept in sync by hand.
  if (!env.BETTER_AUTH_URL && env.VERCEL_ENV === "preview" && env.VERCEL_BRANCH_URL) {
    env.BETTER_AUTH_URL = `https://${env.VERCEL_BRANCH_URL}`;
  }
  if (env.NODE_ENV === "production" && (!env.BETTER_AUTH_SECRET || !env.BETTER_AUTH_URL)) {
    throw new Error("BETTER_AUTH_SECRET (>= 32 chars) and BETTER_AUTH_URL are required in production");
  }
  return { ...env, BETTER_AUTH_URL: env.BETTER_AUTH_URL ?? "http://localhost:3000" };
}
