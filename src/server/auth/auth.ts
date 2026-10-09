import { APIError, betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { after } from "next/server";
import { emailOTP, organization } from "better-auth/plugins";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb, type Db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { users, workspaceMembers, workspaces } from "@/db/schema";
import { getAuthEnv } from "./env";
import { consumeOtpQuota } from "./otp-limit";
import { sendMail, type Mailer } from "./mail";
import { stripProviderTokens } from "./strip-tokens";

/** Factory so tests can inject an in-memory database and capture e-mails; the app uses `getAuth()`. */
export function createAuth({
  db,
  send = sendMail,
  nextJsCookies = true,
  env = getAuthEnv(),
}: {
  db: Db;
  send?: Mailer;
  nextJsCookies?: boolean;
  env?: ReturnType<typeof getAuthEnv>;
}) {
  const baseURL = env.BETTER_AUTH_URL;
  // Social sign-in must never trust an address the provider did not verify (COMP-001). `requireEmailVerification` refuses the
  // session, but Better Auth creates the user and the account first; `databaseHooks.user.create.before` below stops that creation.
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, requireEmailVerification: true } }
      : {};
  const github =
    env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET, requireEmailVerification: true } }
      : {};

  return betterAuth({
    baseURL,
    secret: env.BETTER_AUTH_SECRET,
    // neon-http (ADR-003): for provider "pg" the adapter only opens transactions when `transaction: true`, which we leave off.
    database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
    socialProviders: { ...google, ...github },
    // Counters live in the database: serverless instances do not share memory. Sending codes is the sensitive path.
    rateLimit: {
      storage: "database",
      window: 60,
      max: 100,
      customRules: { "/email-otp/send-verification-otp": { window: 60, max: 3 } },
    },
    hooks: {
      // Runs before the code exists, so a refused request neither rotates nor invalidates a valid code. Same answer for every
      // address (no enumeration). Trade-off: someone can exhaust the quota of a target address and delay its code login for
      // up to an hour; social sign-in still works and the alternative was a ~48% chance of guessing a code in a day (COMP-002).
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/email-otp/send-verification-otp") return;
        const email = (ctx.body as { email?: unknown } | undefined)?.email;
        if (typeof email !== "string") return;
        if (!(await consumeOtpQuota(db, email))) {
          throw new APIError("TOO_MANY_REQUESTS", { message: "Muitos códigos pedidos para este e-mail. Tente de novo mais tarde." });
        }
      }),
    },
    databaseHooks: {
      user: {
        // E-mail codes create verified users; an unverified one can only come from a social provider (COMP-001).
        create: { before: async (user) => (user.emailVerified ? undefined : false) },
      },
      session: {
        create: {
          // Sign in lands directly in the user's first organization (Clerk did this with the "active org").
          before: async (session) => {
            const [first] = await db
              .select({ organizationId: authSchema.member.organizationId })
              .from(authSchema.member)
              .where(eq(authSchema.member.userId, session.userId))
              .orderBy(asc(authSchema.member.createdAt))
              .limit(1);
            return { data: { ...session, activeOrganizationId: first?.organizationId ?? null } };
          },
        },
      },
      account: {
        create: { before: async (account) => ({ data: stripProviderTokens(account) }) },
        update: { before: async (account) => ({ data: stripProviderTokens(account) }) },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: "hashed", // a leaked table must not hold usable codes (COMP-005)
        async sendVerificationOTP({ email, otp }) {
          // Not awaited on purpose (timing attacks), but kept alive with after(): on Vercel the function can be frozen
          // as soon as the response is sent, which silently drops a fire-and-forget fetch. Errors never include the body.
          const task = send({ to: email, subject: "Seu código de acesso ao Compasso", text: `Seu código: ${otp}\nVálido por 5 minutos.` }).catch(
            (e: unknown) => console.error("[auth] failed to send sign-in code", e instanceof Error ? `${e.message}${e.cause ? ` (cause: ${String(e.cause)})` : ""}` : e),
          );
          try {
            after(task);
          } catch {
            // outside a request scope (tests, scripts): the promise simply runs on its own
          }
        },
      }),
      organization({
        requireEmailVerificationOnInvitation: true,
        async sendInvitationEmail({ id, email, organization: org, inviter }) {
          await send({
            to: email,
            subject: `${inviter.user.name || inviter.user.email} convidou você para ${org.name} no Compasso`,
            text: `Aceite o convite: ${baseURL}/accept-invitation/${id}\n(expira em 48 horas)`,
          });
        },
        organizationHooks: {
          // Logical removal (LGPD): the member loses access but their time entries stay.
          afterRemoveMember: async ({ user, organization: org }) => {
            const [ws] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.authOrgId, org.id));
            const [appUser] = await db.select({ id: users.id }).from(users).where(eq(users.authId, user.id));
            if (!ws || !appUser) return;
            const now = new Date();
            await db
              .update(workspaceMembers)
              .set({ removedAt: now, updatedAt: now })
              .where(and(eq(workspaceMembers.workspaceId, ws.id), eq(workspaceMembers.userId, appUser.id), isNull(workspaceMembers.removedAt)));
          },
          // Deleting an organization archives its workspace: every record stays, access is blocked (ADR-034). Terminal.
          afterDeleteOrganization: async ({ organization: org }) => {
            const now = new Date();
            await db.update(workspaces).set({ archivedAt: now, updatedAt: now }).where(and(eq(workspaces.authOrgId, org.id), isNull(workspaces.archivedAt)));
          },
        },
      }),
      ...(nextJsCookies ? [nextCookies()] : []), // must be the last plugin
    ],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/** Lazy singleton, like getDb(): `next build` must not need secrets. */
export function getAuth() {
  return (instance ??= createAuth({ db: getDb() }));
}
