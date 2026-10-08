"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_GROUP_BY, GROUP_BY, GROUP_LABELS } from "@/lib/report";
import { PERIOD_LABELS, PERIOD_PRESETS, type PeriodPreset } from "@/lib/report-period";
import type { ReportQuery } from "@/lib/schemas/report";
import { selectClass } from "../project-task-fields";
import type { CatalogView } from "../types";

export type PersonOption = { id: string; name: string; isRemoved: boolean };

/**
 * Report filters. It is a plain GET form: the URL is the single source of truth (shareable, and the
 * export in the next step reuses it). Client state only drives the client > project > task cascade.
 */
export function ReportFilters({
  catalog,
  people,
  query,
}: {
  catalog: CatalogView;
  /** Null for members: they only ever see their own hours, so there is nothing to pick. */
  people: PersonOption[] | null;
  query: ReportQuery;
}) {
  const [period, setPeriod] = useState<PeriodPreset>(query.periodo);
  const [clientId, setClientId] = useState(query.cliente ?? "");
  const [projectId, setProjectId] = useState(query.projeto ?? "");
  const [taskId, setTaskId] = useState(query.tarefa ?? "");
  const [selected, setSelected] = useState<string[]>(query.pessoas);

  const noProject = projectId === "none";
  const projects = catalog.projects.filter((p) => !clientId || p.organizationId === clientId);
  const tasks = catalog.tasks.filter((t) => t.projectId === projectId);

  return (
    <form method="get" action="/relatorios" className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="grid gap-1.5 text-sm font-medium">
        Período
        <select name="periodo" className={selectClass} value={period} onChange={(e) => setPeriod(e.target.value as PeriodPreset)}>
          {PERIOD_PRESETS.map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABELS[p]}
            </option>
          ))}
        </select>
      </label>

      {period === "custom" && (
        <div className="grid grid-cols-2 gap-2 sm:col-span-1 lg:col-span-1">
          <label className="grid gap-1.5 text-sm font-medium">
            De
            <Input type="date" name="de" defaultValue={query.de} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Até
            <Input type="date" name="ate" defaultValue={query.ate} required />
          </label>
        </div>
      )}

      <label className="grid gap-1.5 text-sm font-medium">
        Cliente
        <select
          name="cliente"
          className={selectClass}
          value={noProject ? "" : clientId}
          disabled={noProject}
          onChange={(e) => {
            setClientId(e.target.value);
            setProjectId("");
            setTaskId("");
          }}
        >
          <option value="">Todos os clientes</option>
          {catalog.organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-medium">
        Projeto
        <select
          name="projeto"
          className={selectClass}
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setTaskId("");
          }}
        >
          <option value="">Todos os projetos</option>
          <option value="none">Sem projeto</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.isArchived ? " (arquivado)" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-medium">
        Tarefa
        <select
          name="tarefa"
          className={selectClass}
          value={taskId}
          disabled={!projectId || noProject || tasks.length === 0}
          onChange={(e) => setTaskId(e.target.value)}
        >
          <option value="">Todas as tarefas</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.isCompleted ? " (concluída)" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-medium">
        Agrupar por
        {/* A view option, not a filter: applies at once so the screen, the export links and the downloads never disagree. */}
        <select name="agrupar" className={selectClass} defaultValue={query.agrupar ?? DEFAULT_GROUP_BY} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
          {GROUP_BY.map((g) => (
            <option key={g} value={g}>
              {GROUP_LABELS[g]}
            </option>
          ))}
        </select>
      </label>

      {people && (
        <details className="relative text-sm">
          <summary className={`${selectClass} cursor-pointer list-none items-center justify-between font-normal`}>
            {selected.length === 0 ? "Todas as pessoas" : `${selected.length} ${selected.length === 1 ? "pessoa" : "pessoas"}`}
          </summary>
          <fieldset className="absolute z-10 mt-1 grid max-h-64 w-full min-w-56 gap-1 overflow-auto rounded-md border bg-popover p-2 shadow-md">
            <legend className="sr-only">Pessoas</legend>
            {people.map((p) => (
              <label key={p.id} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-accent">
                <input
                  type="checkbox"
                  name="pessoas"
                  value={p.id}
                  checked={selected.includes(p.id)}
                  onChange={(e) => setSelected((cur) => (e.target.checked ? [...cur, p.id] : cur.filter((id) => id !== p.id)))}
                />
                <span>
                  {p.name}
                  {p.isRemoved ? " (removido)" : ""}
                </span>
              </label>
            ))}
            {selected.length > 0 && (
              <button type="button" className="mt-1 text-left text-xs text-muted-foreground underline" onClick={() => setSelected([])}>
                Limpar seleção (todas)
              </button>
            )}
          </fieldset>
        </details>
      )}

      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit">Gerar relatório</Button>
        <Button asChild variant="ghost">
          <Link href="/relatorios">Limpar</Link>
        </Button>
      </div>
    </form>
  );
}
