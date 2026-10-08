"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERIOD_LABELS, PERIOD_PRESETS, type PeriodPreset } from "@/lib/report-period";
import type { ReportQuery } from "@/lib/schemas/report";
import type { PersonOption } from "../relatorios/report-filters";
import { selectClass } from "../project-task-fields";

/**
 * Dashboard filters: period and (for admins) people only. A plain GET form like the report's, so the URL
 * stays the source of truth. Choosing a preset applies at once; a custom range needs its dates, so it has a button.
 */
export function PanelFilters({ people, query }: { people: PersonOption[] | null; query: ReportQuery }) {
  const [period, setPeriod] = useState<PeriodPreset>(query.periodo);
  const [selected, setSelected] = useState<string[]>(query.pessoas);

  return (
    <form method="get" action="/painel" className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1.5 text-sm font-medium">
        Período
        <select
          name="periodo"
          className={selectClass}
          value={period}
          onChange={(e) => {
            const next = e.target.value as PeriodPreset;
            setPeriod(next);
            if (next !== "custom") e.currentTarget.form?.requestSubmit();
          }}
        >
          {PERIOD_PRESETS.map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABELS[p]}
            </option>
          ))}
        </select>
      </label>

      {period === "custom" && (
        <>
          <label className="grid gap-1.5 text-sm font-medium">
            De
            <Input type="date" name="de" defaultValue={query.de} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Até
            <Input type="date" name="ate" defaultValue={query.ate} required />
          </label>
        </>
      )}

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

      {(period === "custom" || people) && <Button type="submit">Atualizar</Button>}
      <Button asChild variant="ghost">
        <Link href="/painel">Limpar</Link>
      </Button>
    </form>
  );
}
