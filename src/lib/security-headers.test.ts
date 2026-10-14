import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

const header = (key: string) => securityHeaders.find((h) => h.key === key)?.value;

describe("security headers (COMP-003)", () => {
  it("applies to every path", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const all = rules.find((r) => r.source === "/:path*");
    expect(all?.headers).toEqual(securityHeaders);
  });

  it("forbids framing in both the modern and the legacy way", () => {
    expect(header("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(header("X-Frame-Options")).toBe("DENY");
  });

  describe("full policy, enforced (COMP-015)", () => {
    const directive = (policy: string, name: string) => policy.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";
    const prod = contentSecurityPolicy(false);

    it("is the enforced policy, with no Report-Only copy left behind", () => {
      expect(header("Content-Security-Policy")).toBe(contentSecurityPolicy(process.env.NODE_ENV === "development"));
      expect(header("Content-Security-Policy")).toContain("default-src 'self'");
      expect(header("Content-Security-Policy-Report-Only")).toBeUndefined();
    });

    it("lets Turnstile load, render its iframe and call home, and nothing else third-party", () => {
      expect(directive(prod, "script-src")).toContain("https://challenges.cloudflare.com");
      expect(directive(prod, "frame-src")).toBe("frame-src https://challenges.cloudflare.com");
      expect(directive(prod, "connect-src")).toBe("connect-src 'self' https://challenges.cloudflare.com");
      expect(prod.match(/https?:\/\/[^\s;]+/g)?.every((o) => o === "https://challenges.cloudflare.com")).toBe(true);
    });

    it("allows eval only in development", () => {
      expect(prod).not.toContain("unsafe-eval");
      expect(contentSecurityPolicy(true)).toContain("'unsafe-eval'");
    });

    it("keeps framing, plugins and base/form hijacking closed", () => {
      for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) expect(prod).toContain(d);
    });
  });

  it("sets the rest of the baseline", () => {
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header("Permissions-Policy")).toContain("camera=()");
    expect(header("Strict-Transport-Security")).toMatch(/^max-age=\d+$/);
  });

  it("never preloads HSTS (that is a decision about the whole domain)", () => {
    expect(header("Strict-Transport-Security")).not.toMatch(/preload|includeSubDomains/);
  });

  it("keeps the service worker revalidation rule", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules.find((r) => r.source === "/sw.js")?.headers.some((h) => h.key === "Cache-Control")).toBe(true);
  });
});
