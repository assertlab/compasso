import { getAuthEnv } from "./env";

export type Mail = { to: string; subject: string; text: string };
export type Mailer = (message: Mail) => Promise<void>;

/**
 * Transactional mail through the Resend REST API (no SDK). Without a key it only prints to the console, and only
 * outside production: in production a missing key is an error and e-mail bodies (which carry OTPs) are never logged.
 */
export const sendMail: Mailer = async (message) => {
  const env = getAuthEnv();
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    if (env.NODE_ENV === "production") throw new Error("RESEND_API_KEY and MAIL_FROM are required in production");
    console.info(`[mail:dev] to=${message.to} subject="${message.subject}"\n${message.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM, ...message }),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}`);
};
