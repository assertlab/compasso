import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type Sw = {
  classify: (r: { method: string; mode: string; url: string }, origin: string) => "navigate" | "static" | "ignore";
  staticAssetsIn: (html: string) => string[];
};
const { classify, staticAssetsIn } = createRequire(import.meta.url)("../../public/sw.js") as Sw;

const origin = "https://compasso.test";
const req = (url: string, mode = "cors", method = "GET") => ({ method, mode, url });

describe("service worker request routing", () => {
  it("falls back to /offline only for same-origin page navigations", () => {
    expect(classify(req(`${origin}/`, "navigate"), origin)).toBe("navigate");
    expect(classify(req(`${origin}/reports?month=2026-02`, "navigate"), origin)).toBe("navigate");
  });

  it("caches only immutable public assets", () => {
    expect(classify(req(`${origin}/_next/static/chunks/app.js`), origin)).toBe("static");
    expect(classify(req(`${origin}/icons/icon-192.png`), origin)).toBe("static");
  });

  it("never touches API, RSC, data or non-GET requests (no authenticated data cached)", () => {
    expect(classify(req(`${origin}/api/webhooks/anything`, "cors", "POST"), origin)).toBe("ignore");
    expect(classify(req(`${origin}/api/anything`), origin)).toBe("ignore");
    expect(classify(req(`${origin}/?_rsc=abc`), origin)).toBe("ignore");
    expect(classify(req(`${origin}/_next/static/x.js`, "cors", "POST"), origin)).toBe("ignore");
  });

  it("ignores cross-origin requests, including identity providers", () => {
    expect(classify(req("https://refined-turtle-6211.accounts.dev/sign-in", "navigate"), origin)).toBe("ignore");
    expect(classify(req("https://cdn.example.com/_next/static/a.js"), origin)).toBe("ignore");
  });
});

describe("staticAssetsIn", () => {
  it("extracts unique build assets from HTML", () => {
    const html = `<link href="/_next/static/css/a.css"><script src="/_next/static/chunks/b.js"></script><script src="/_next/static/chunks/b.js"></script><a href="/x">`;
    expect(staticAssetsIn(html)).toEqual(["/_next/static/css/a.css", "/_next/static/chunks/b.js"]);
  });

  it("returns an empty list when there are none", () => {
    expect(staticAssetsIn("<p>oi</p>")).toEqual([]);
  });
});
