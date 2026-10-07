"use client";

import { Play, Square } from "lucide-react";
import { useOptimistic, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { formatHms } from "@/lib/time";
import { startTimerAction, stopTimerAction } from "./actions";
import { DescriptionInput } from "./description-input";
import { ProjectTaskFields } from "./project-task-fields";
import type { CatalogView } from "./types";

export type RunningView = {
  startedAt: string;
  description: string;
  projectLabel: string | null;
};

const subscribeToClock = (onChange: () => void) => {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
};
const clockSnapshot = () => Math.floor(Date.now() / 1000);
const serverClockSnapshot = () => 0;

/** Live HH:MM:SS. Shows 00:00:00 during server render/hydration, then ticks every second. */
function Elapsed({ startedAt }: { startedAt: string }) {
  const nowSeconds = useSyncExternalStore(subscribeToClock, clockSnapshot, serverClockSnapshot);
  const seconds = nowSeconds === 0 ? 0 : Math.max(0, nowSeconds - Math.floor(new Date(startedAt).getTime() / 1000));
  return (
    <span className="font-mono text-3xl tabular-nums" role="timer" aria-live="off">
      {formatHms(seconds)}
    </span>
  );
}

/**
 * Start/stop control. The UI flips instantly (useOptimistic) and the server confirms;
 * if the server refuses (e.g. a timer runs in another workspace) the UI rolls back and says why.
 */
export function TimerBar({
  running,
  elsewhere,
  catalog,
}: {
  running: RunningView | null;
  elsewhere: { workspaceName: string; startedAt: string } | null;
  catalog: CatalogView;
}) {
  const [shown, setShown] = useOptimistic<RunningView | null, RunningView | null>(running, (_current, next) => next);
  const [error, setError] = useState<string | null>(null);

  async function start(formData: FormData) {
    setError(null);
    const projectId = String(formData.get("projectId") ?? "");
    const project = catalog.projects.find((p) => p.id === projectId);
    setShown({
      startedAt: new Date().toISOString(),
      description: String(formData.get("description") ?? ""),
      projectLabel: project?.name ?? null,
    });
    const result = await startTimerAction(formData);
    if (!result.ok) setError(result.message ?? Object.values(result.fieldErrors ?? {})[0] ?? "Não foi possível iniciar.");
  }

  async function stop() {
    setError(null);
    setShown(null);
    const result = await stopTimerAction();
    if (!result.ok) setError(result.message ?? "Não foi possível parar.");
  }

  return (
    <div className="grid gap-3 rounded-lg border bg-card p-4 text-card-foreground">
      {elsewhere && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
          Você tem um timer rodando em <strong>{elsewhere.workspaceName}</strong>. Troque de workspace para pará-lo antes de iniciar outro aqui.
        </p>
      )}

      {shown ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{shown.description || "Sem descrição"}</p>
            <p className="truncate text-sm text-muted-foreground">{shown.projectLabel ?? "Sem projeto"}</p>
          </div>
          <div className="flex items-center gap-3">
            <Elapsed startedAt={shown.startedAt} />
            <form action={stop}>
              <Button type="submit" className="bg-running text-running-foreground hover:bg-running/90">
                <Square aria-hidden />
                Parar
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <form action={start} className="grid gap-3">
          <DescriptionInput placeholder="No que você está trabalhando?" aria-label="Descrição" />
          <ProjectTaskFields catalog={catalog} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isBillable" defaultChecked className="size-4 accent-primary" />
              Faturável
            </label>
            <Button type="submit" disabled={elsewhere !== null}>
              <Play aria-hidden />
              Iniciar
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
