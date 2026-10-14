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
  // Cloudflare Turnstile on the sign-in code request (COMP-014). Both or neither: with neither, the challenge is off
  // (local development, Preview deployments, tests). Vercel production requires both, see below.
  TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  // Who may create an account (ADR-038). "closed": only allow-listed or invited e-mails (and people who already have an account).
  // Defaults to "open" for development, Preview and tests; Vercel production must say which one it wants.
  ACCESS_MODE: z.enum(["open", "closed"]).optional(),
});

export type AuthEnv = Omit<z.infer<typeof schema>, "ACCESS_MODE"> & { BETTER_AUTH_URL: string; ACCESS_MODE: "open" | "closed" };

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
  if (Boolean(env.TURNSTILE_SITE_KEY) !== Boolean(env.TURNSTILE_SECRET_KEY)) {
    throw new Error("TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must be set together");
  }
  // The challenge was once left off in production without anyone noticing: there it is not optional.
  if (env.VERCEL_ENV === "production" && !env.TURNSTILE_SITE_KEY) {
    throw new Error("TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are required in Vercel production");
  }
  // Same lesson as the challenge above: an unset switch must not silently mean "open" in production.
  if (env.VERCEL_ENV === "production" && !env.ACCESS_MODE) {
    throw new Error('ACCESS_MODE ("open" or "closed") is required in Vercel production');
  }
  return { ...env, BETTER_AUTH_URL: env.BETTER_AUTH_URL ?? "http://localhost:3000", ACCESS_MODE: env.ACCESS_MODE ?? "open" };
}
