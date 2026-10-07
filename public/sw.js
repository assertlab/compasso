/*
 * Compasso service worker (ADR-012). Deliberately minimal:
 *  - the only page ever served from cache is /offline (static, no user data), as a
 *    fallback when a navigation fails because the device is offline;
 *  - immutable public assets (/_next/static, /icons) are cached for faster loads;
 *  - nothing else is cached: no HTML of app pages, no RSC payloads, no API
 *    responses, no authenticated data. Anything not matched goes straight to the network.
 * Bump VERSION to drop old caches.
 */
const VERSION = "v1";
const CACHE = `compasso-static-${VERSION}`;
const OFFLINE_URL = "/offline";

/** Decides how a request is handled: "navigate" | "static" | "ignore". Pure, so it can be unit tested. */
function classify({ method, mode, url }, origin) {
  if (method !== "GET") return "ignore";
  const { origin: reqOrigin, pathname } = new URL(url);
  if (reqOrigin !== origin) return "ignore";
  if (mode === "navigate") return "navigate";
  if (pathname.startsWith("/_next/static/") || pathname.startsWith("/icons/")) return "static";
  return "ignore";
}

/** Same-origin build assets referenced by a piece of HTML, so /offline renders styled with no network. */
function staticAssetsIn(html) {
  return [...new Set(html.match(/\/_next\/static\/[^"'\s\\)]+/g) ?? [])];
}

if (typeof module !== "undefined") module.exports = { classify, staticAssetsIn };

if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
  self.addEventListener("install", (event) => {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE);
        const response = await fetch(OFFLINE_URL, { cache: "reload" });
        if (!response.ok) throw new Error(`Cannot precache ${OFFLINE_URL}: ${response.status}`);
        const html = await response.clone().text();
        await cache.put(OFFLINE_URL, response);
        // Best effort: a missing asset must not block the install.
        await Promise.allSettled(staticAssetsIn(html).map((asset) => cache.add(asset)));
        await self.skipWaiting();
      })(),
    );
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
        await self.clients.claim();
      })(),
    );
  });

  self.addEventListener("fetch", (event) => {
    const { request } = event;
    const kind = classify(request, self.location.origin);
    if (kind === "navigate") {
      event.respondWith(
        fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
      );
    } else if (kind === "static") {
      event.respondWith(
        caches.match(request).then(
          (hit) =>
            hit ??
            fetch(request).then((response) => {
              if (response.ok) {
                const copy = response.clone();
                caches.open(CACHE).then((cache) => cache.put(request, copy));
              }
              return response;
            }),
        ),
      );
    }
  });
}
