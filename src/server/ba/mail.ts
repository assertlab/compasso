/**
 * SPIKE: minimal transactional mail. With RESEND_API_KEY it posts to the Resend REST API (no SDK dependency);
 * without it the message is logged to the server console, which is enough to test the flows locally.
 */
export async function sendMail(message: { to: string; subject: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`[spike mail] to=${message.to} subject="${message.subject}"\n${message.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM ?? "Compasso <onboarding@resend.dev>", ...message }),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}`);
}
