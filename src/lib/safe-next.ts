const BASE = "http://local.invalid";

/** Post-login redirect target: only same-origin paths ("/x?y"), never "//host", "/\\host" or absolute URLs (open redirect). */
export function safeNext(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  try {
    const url = new URL(value, BASE);
    return url.origin === BASE ? url.pathname + url.search : fallback;
  } catch {
    return fallback;
  }
}
