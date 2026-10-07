"use client";

import { useEffect } from "react";

/** Registers the minimal service worker (public/sw.js). Production only: in dev it would cache stale builds. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => console.error("service worker registration failed", error));
  }, []);
  return null;
}
