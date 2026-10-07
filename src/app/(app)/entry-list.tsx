"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatHms } from "@/lib/time";
import { deleteEntryAction, restoreEntryAction } from "./actions";
import { EntryDialog } from "./entry-dialog";
import type { CatalogView, EntryView } from "./types";

export function EntryList({ entries, catalog, today }: { entries: EntryView[]; catalog: CatalogView; today: string }) {
  const [removed, setRemoved] = useState<{ id: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const projectName = (id: string | null) => {
    const project = catalog.projects.find((p) => p.id === id);
    if (!project) return "Sem projeto";
    const org = catalog.organizations.find((o) => o.id === project.organizationId);
    return org ? `${project.name} · ${org.name}` : project.name;
  };

  function remove(entry: EntryView) {
    startTransition(async () => {
      setError(null);
      const result = await deleteEntryAction(entry.id);
      if (result.ok) setRemoved({ id: entry.id, label: entry.description || "Registro sem descrição" });
      else setError(result.message ?? "Não foi possível remover.");
    });
  }

  function undo(id: string) {
    startTransition(async () => {
      setError(null);
      const result = await restoreEntryAction(id);
      if (result.ok) setRemoved(null);
      else setError(result.message ?? "Não foi possível desfazer.");
    });
  }

  return (
    <div className="grid gap-2">
      {removed && (
        <p role="status" className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
          <span className="truncate">“{removed.label}” removido.</span>
          <Button variant="link" size="sm" disabled={pending} onClick={() => undo(removed.id)}>
            Desfazer
          </Button>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum registro hoje. Inicie o timer ou lance horas.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{entry.description || "Sem descrição"}</p>
                <p className="truncate text-sm text-muted-foreground">{projectName(entry.projectId)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {!entry.isBillable && <Badge variant="secondary">Não faturável</Badge>}
                  {entry.tagIds.map((id) => {
                    const tag = catalog.tags.find((t) => t.id === id);
                    return tag ? (
                      <Badge key={id} variant="outline">
                        {tag.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono tabular-nums">{entry.durationSeconds === null ? "em andamento" : formatHms(entry.durationSeconds)}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.startTime}–{entry.endTime ?? "…"}
                </p>
              </div>
              <EntryDialog catalog={catalog} entry={entry} today={today} />
              <Button variant="ghost" size="icon" aria-label="Remover registro" disabled={pending} onClick={() => remove(entry)}>
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
