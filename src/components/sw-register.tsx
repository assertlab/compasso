"use client";

import { useEffect } from "react";

const isLocalHost = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "[::1]";

/**
 * Registers the minimal service worker (public/sw.js) in production on real hosts only.
 * On localhost (dev, or a local `next start`) it would serve stale bundles, so any worker left over
 * from an earlier local production run is unregistered and its caches are dropped.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (isLocalHost(window.location.hostname)) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .then(() => ("caches" in window ? caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))) : undefined))
        .catch(() => undefined);
      return;
    }
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => console.error("service worker registration failed", error));
  }, []);
  return null;
}
