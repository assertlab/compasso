/** Cloudflare Turnstile (sign-in code request) loads a script, an iframe and talks to its own origin. */
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/**
 * Full policy, sent as Report-Only first (COMP-015): the browser logs what it would block and blocks nothing. It is an origin
 * allowlist, not a nonce policy: nonces force every page into dynamic rendering and the Next 16 docs call them incompatible
 * with Partial Prerendering, which almost every route here uses. So `script-src` keeps 'unsafe-inline' (React's inline
 * bootstrap data) and does not stop an injected inline script; it does stop scripts, frames and connections to other origins.
 * Development adds 'unsafe-eval' (React debugging) — never in production.
 */
export function contentSecurityPolicy(isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${TURNSTILE_ORIGIN}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${TURNSTILE_ORIGIN}`,
    `frame-src ${TURNSTILE_ORIGIN}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * Security headers sent on every response (audit COMP-003). Kept in a plain module so a test can pin them.
 *
 * The enforced Content-Security-Policy is the small subset below, which does not change how pages render; the full policy
 * above runs beside it in Report-Only until the console shows no violations from real use (then it replaces this one).
 * - `frame-ancestors 'none'` / `X-Frame-Options: DENY`: no framing, so no clickjacking of admin actions.
 * - `form-action 'self'`, `base-uri 'self'`, `object-src 'none'`: close the cheapest injection follow-ups.
 * - HSTS without `preload`: preload would be a decision about the whole assertlab.com domain, not about this app.
 */
export const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy(process.env.NODE_ENV === "development") },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];
