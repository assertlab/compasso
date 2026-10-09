/**
 * Security headers sent on every response (audit COMP-003). Kept in a plain module so a test can pin them.
 *
 * Deliberately NOT a full Content-Security-Policy yet: `script-src` needs per-request nonces with Next 16 and the app has
 * inline scripts, so a strict policy must be tried page by page. This subset has no effect on how pages render.
 * - `frame-ancestors 'none'` / `X-Frame-Options: DENY`: no framing, so no clickjacking of admin actions.
 * - `form-action 'self'`, `base-uri 'self'`, `object-src 'none'`: close the cheapest injection follow-ups.
 * - HSTS without `preload`: preload would be a decision about the whole assertlab.com domain, not about this app.
 */
export const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];
