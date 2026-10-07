import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Sem conexão" };

// Served by the service worker when a navigation fails offline. Static and free of user data,
// and a plain link (not a button) so "try again" works even if no JavaScript is available.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Logo />
      <WifiOff className="size-8 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-semibold tracking-tight">Sem conexão</h1>
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar esta tela. Seus registros já salvos estão seguros; reconecte-se e tente novamente.
      </p>
      {/* Plain <a> on purpose: a full page load must hit the network (and the service worker), not a client-side transition. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Tentar novamente
      </a>
    </main>
  );
}
