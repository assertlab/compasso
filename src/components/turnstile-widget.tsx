"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TURNSTILE_ACTION } from "@/lib/turnstile";

type Api = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Api;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<Api> | undefined;

/** Loads Cloudflare's script once per page. Resolves with the API or rejects (blocked network, ad blocker). */
function loadTurnstile(): Promise<Api> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<Api>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new Error("turnstile script failed"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export type TurnstileState = { token: string | null; status: "loading" | "ready" | "error"; reset: () => void };

/**
 * Invisible-until-needed Turnstile challenge for the sign-in code request (COMP-014). Without a site key (local
 * development, Preview) it reports `ready` with no token and renders nothing. A token is single-use: call `reset()`
 * after every request that consumed it.
 */
export function useTurnstile(siteKey: string | undefined) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<TurnstileState["status"]>(siteKey ? "loading" : "ready");

  useEffect(() => {
    if (!siteKey || !container.current) return;
    let cancelled = false;
    const el = container.current;
    loadTurnstile()
      .then((api) => {
        if (cancelled) return;
        widgetId.current = api.render(el, {
          sitekey: siteKey,
          action: TURNSTILE_ACTION,
          appearance: "interaction-only", // invisible unless Cloudflare needs the person to act
          callback: (t: string) => {
            setToken(t);
            setStatus("ready");
          },
          "expired-callback": () => setToken(null),
          "timeout-callback": () => setToken(null),
          "error-callback": () => {
            setToken(null);
            setStatus("error");
          },
        });
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);

  const reset = useCallback(() => {
    setToken(null);
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }, []);

  return { containerRef: container, token, status, reset };
}
