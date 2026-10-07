"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Shows a banner while the browser reports no connection. Assumes online on the server and before hydration. */
export function OfflineNotice() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-border bg-muted px-4 py-2 text-center text-sm text-muted-foreground"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span>Você está sem conexão. Alterações feitas agora não serão salvas até a conexão voltar.</span>
    </div>
  );
}
