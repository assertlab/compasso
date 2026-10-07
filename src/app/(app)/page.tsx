import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { requireWorkspaceContext } from "@/server/workspace-context";

export default function Home() {
  return (
    <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-muted" aria-hidden />}>
      <Today />
    </Suspense>
  );
}

async function Today() {
  const ctx = await requireWorkspaceContext();
  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {ctx.workspaceName}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Olá{ctx.userName ? `, ${ctx.userName.split(" ")[0]}` : ""}
      </h1>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{ctx.role === "admin" ? "Administrador" : "Membro"}</Badge>
        <span className="text-sm text-muted-foreground">Fuso: {ctx.timezone}</span>
      </div>
      <p className="font-mono text-2xl tabular-nums">00:00:00</p>
    </section>
  );
}
