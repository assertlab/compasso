"use client";

import { ChevronDown, ChevronRight, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDayLabel, formatWeekLabel, groupEntries } from "@/lib/entry-groups";
import { formatHms } from "@/lib/time";
import { deleteEntryAction, restoreEntryAction, resumeEntryAction } from "./actions";
import { EntryDialog } from "./entry-dialog";
import type { CatalogView, EntryView } from "./types";

type Props = { entries: EntryView[]; catalog: CatalogView; today: string; currentWeek: string; loadMoreHref: string | null };

const Total = ({ seconds, className }: { seconds: number; className?: string }) => (
  <span className={`font-mono tabular-nums ${className ?? ""}`}>{formatHms(seconds)}</span>
);

/** Weeks > days > same-activity groups, each with its total. Several entries of one activity collapse behind a counter. */
export function EntryList({ entries, catalog, today, currentWeek, loadMoreHref }: Props) {
  const [removed, setRemoved] = useState<{ id: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const weeks = useMemo(() => groupEntries(entries), [entries]);

  const projectName = (id: string | null) => {
    const project = catalog.projects.find((p) => p.id === id);
    if (!project) return "Sem projeto";
    const org = catalog.organizations.find((o) => o.id === project.organizationId);
    return org ? `${project.name} · ${org.name}` : project.name;
  };

  function run(work: () => Promise<{ ok: boolean; message?: string; fieldErrors?: Record<string, string> }>, fallback: string, onOk?: () => void) {
    startTransition(async () => {
      setError(null);
      const result = await work();
      if (result.ok) onOk?.();
      else setError(result.message ?? Object.values(result.fieldErrors ?? {})[0] ?? fallback);
    });
  }

  const remove = (entry: EntryView) =>
    run(() => deleteEntryAction(entry.id), "Não foi possível remover.", () => setRemoved({ id: entry.id, label: entry.description || "Registro sem descrição" }));
  const undo = (id: string) => run(() => restoreEntryAction(id), "Não foi possível desfazer.", () => setRemoved(null));
  const resume = (entry: EntryView) => run(() => resumeEntryAction(entry.id), "Não foi possível iniciar.");
  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const playButton = (entry: EntryView) =>
    entry.endedAt !== null ? (
      <Button variant="outline" size="icon" aria-label="Iniciar novamente" title="Iniciar novamente" disabled={pending} onClick={() => resume(entry)}>
        <Play aria-hidden />
      </Button>
    ) : (
      <span className="size-9 shrink-0" aria-hidden />
    );

  const details = (entry: EntryView) => (
    <>
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
    </>
  );

  const entryRow = (entry: EntryView, nested = false) => (
    <li key={entry.id} className={`flex items-center gap-2 p-3 ${nested ? "border-t border-border/60 bg-background pl-12" : ""}`}>
      {playButton(entry)}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{entry.description || "Sem descrição"}</p>
        {details(entry)}
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
  );

  return (
    <div className="grid gap-4">
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

      {weeks.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum registro ainda. Inicie o timer ou lance horas.</p>
      ) : (
        weeks.map((week) => (
          <section key={week.weekStart} aria-label={formatWeekLabel(week.weekStart, currentWeek)} className="grid gap-2">
            <h2 className="flex items-baseline justify-between text-sm font-medium">
              <span>{formatWeekLabel(week.weekStart, currentWeek)}</span>
              <span className="text-muted-foreground">
                Total da semana: <Total seconds={week.totalSeconds} className="text-base font-semibold text-foreground" />
              </span>
            </h2>
            {week.days.map((day) => (
              <div key={day.date} className="overflow-hidden rounded-lg border bg-card">
                <h3 className="flex items-baseline justify-between bg-muted px-3 py-2 text-sm">
                  <span className="font-medium">{day.date === today ? `Hoje · ${formatDayLabel(day.date)}` : formatDayLabel(day.date)}</span>
                  <span className="text-muted-foreground">
                    Total: <Total seconds={day.totalSeconds} className="font-semibold text-foreground" />
                  </span>
                </h3>
                <ul className="divide-y">
                  {day.groups.map((group) => {
                    if (group.entries.length === 1) return entryRow(group.entries[0]);
                    const id = `${day.date}|${group.key}`;
                    const open = expanded.has(id);
                    const latest = group.entries[0];
                    const resumable = group.entries.find((e) => e.endedAt !== null);
                    const running = group.entries.some((e) => e.endedAt === null);
                    return (
                      <li key={id} className={open ? "border-l-4 border-l-primary bg-accent/40" : "border-l-4 border-l-transparent"}>
                        <ul>
                          <li className="flex items-center gap-2 p-3">
                            {playButton(resumable ?? latest)}
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-2 truncate font-medium">
                                <button
                                  type="button"
                                  onClick={() => toggle(id)}
                                  aria-expanded={open}
                                  aria-label={open ? "Recolher registros" : `Mostrar ${group.entries.length} registros`}
                                  className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-primary px-2 text-sm font-semibold tabular-nums text-primary-foreground hover:bg-primary/90"
                                >
                                  {group.entries.length}
                                  {open ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                                </button>
                                <span className="truncate font-semibold">{latest.description || "Sem descrição"}</span>
                              </p>
                              <p className="truncate text-sm text-muted-foreground">{projectName(latest.projectId)}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="font-mono tabular-nums">{formatHms(group.totalSeconds)}</p>
                              {running && <p className="text-xs text-muted-foreground">+ em andamento</p>}
                            </div>
                            <span className="w-[4.5rem] shrink-0" aria-hidden />
                          </li>
                          {open && group.entries.map((entry) => entryRow(entry, true))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        ))
      )}

      {loadMoreHref && (
        <Button asChild variant="outline" className="justify-self-center">
          <Link href={loadMoreHref}>Carregar semana anterior</Link>
        </Button>
      )}
    </div>
  );
}
