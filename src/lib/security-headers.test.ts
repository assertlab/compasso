import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { securityHeaders } from "./security-headers";

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
