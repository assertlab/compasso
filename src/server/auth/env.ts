import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(3).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
});

export type AuthEnv = z.infer<typeof schema> & { BETTER_AUTH_URL: string };

/**
 * Kept apart from `getEnv()` on purpose: until the switch from Clerk (ADR-033) a production deploy without these
 * variables must keep working. In production the secret and the public URL are mandatory.
 */
export function getAuthEnv(source: Record<string, string | undefined> = process.env): AuthEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid auth environment variables: ${JSON.stringify(z.flattenError(parsed.error).fieldErrors)}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production" && (!env.BETTER_AUTH_SECRET || !env.BETTER_AUTH_URL)) {
    throw new Error("BETTER_AUTH_SECRET (>= 32 chars) and BETTER_AUTH_URL are required in production");
  }
  return { ...env, BETTER_AUTH_URL: env.BETTER_AUTH_URL ?? "http://localhost:3000" };
}
