import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, organization } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { sendMail } from "./mail";

type AuthDb = Parameters<typeof drizzleAdapter>[0];
type Mailer = (message: { to: string; subject: string; text: string }) => Promise<void>;

/** Factory so tests can inject an in-memory database and capture e-mails; the app uses `getAuth()`. */
export function createAuth({
  db,
  send = sendMail,
  nextJsCookies = true,
}: {
  db: AuthDb & ReturnType<typeof getDb>;
  send?: Mailer;
  nextJsCookies?: boolean;
}) {
  const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const google =
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
      : {};
  const github =
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? { github: { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET } }
      : {};

  return betterAuth({
    baseURL,
    secret: process.env.BETTER_AUTH_SECRET,
    // neon-http (ADR-003): for provider "pg" the adapter only opens transactions when `transaction: true`, which we leave off.
    database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
    socialProviders: { ...google, ...github },
    databaseHooks: {
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
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        async sendVerificationOTP({ email, otp }) {
          // Not awaited on purpose (timing attacks); errors are only logged. On Vercel use `after()` if delivery gets cut.
          void send({ to: email, subject: "Seu código de acesso ao Compasso", text: `Seu código: ${otp}\nVálido por 5 minutos.` }).catch(
            (e) => console.error("[spike mail] failed", e),
          );
        },
      }),
      organization({
        async sendInvitationEmail({ id, email, organization: org, inviter }) {
          await send({
            to: email,
            subject: `${inviter.user.name} convidou você para ${org.name} no Compasso`,
            text: `Aceite o convite: ${baseURL}/spike/accept/${id}\n(expira em 48 horas)`,
          });
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
