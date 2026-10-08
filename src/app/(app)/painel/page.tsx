import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { buildHighlights, type TopItem } from "@/lib/dashboard";
import { formatDayLabel } from "@/lib/entry-groups";
import { summarize } from "@/lib/report";
import { buildCharts, formatPercent } from "@/lib/report-charts";
import { buildDayMatrix } from "@/lib/report-days";
import { toSearchParams } from "@/lib/schemas/report";
import { formatHms } from "@/lib/time";
import { getTenant } from "@/server/get-tenant";
import { ReportChartsSection } from "../relatorios/charts";
import { loadReport } from "../relatorios/load-report";
import { PanelFilters } from "./panel-filters";

export const metadata: Metadata = { title: "Painel" };

export default function PanelPage({ searchParams }: PageProps<"/painel">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" aria-hidden />}>
      <Panel searchParams={searchParams} />
    </Suspense>
  );
}

async function Panel({ searchParams }: Pick<PageProps<"/painel">, "searchParams">) {
  const { ctx, tenant } = await getTenant();
  const report = await loadReport(tenant, ctx, await searchParams);
  const { query, period, isAdmin } = report;

  const summary = summarize(report.rows, "descricao");
  const matrix = buildDayMatrix(report.rows, period, ctx.timezone, { includePeople: false });
  const charts = buildCharts(summary, matrix);
  const h = buildHighlights(report.rows, summary, ctx.timezone);
  // The same period and people, opened in the full report (filters by client/project live there).
  const reportHref = `/relatorios?${toSearchParams({ ...query, cliente: undefined, projeto: undefined, tarefa: undefined, agrupar: undefined })}`;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
          <p className="text-sm text-muted-foreground">
            {report.periodLabel}: {formatDayLabel(period.fromDate)} {period.fromDate.slice(0, 4)} – {formatDayLabel(period.toDate)} {period.toDate.slice(0, 4)}
            {!isAdmin && " · apenas os seus registros"}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={reportHref}>Ver relatório completo</Link>
        </Button>
      </div>

      <PanelFilters people={report.people} query={query} />

      {report.periodError && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {report.periodError} Mostrando o mês atual.
        </p>
      )}
      {report.runningCount > 0 && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {report.runningCount === 1 ? "Há 1 timer em andamento" : `Há ${report.runningCount} timers em andamento`} neste período. Ele só entra depois de parado.
        </p>
      )}

      {h.totalEntries === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum registro neste período.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Total de horas" value={formatHms(h.totalSeconds)} detail={`${h.totalEntries} ${h.totalEntries === 1 ? "registro" : "registros"} em ${h.activeDays} ${h.activeDays === 1 ? "dia" : "dias"}`} />
            <Tile label="Projeto principal" value={h.topProject?.label ?? "—"} detail={topDetail(h.topProject)} text />
            <Tile label="Cliente principal" value={h.topClient?.label ?? "—"} detail={topDetail(h.topClient, false)} text />
            <Tile
              label="Dia mais cheio"
              value={h.busiestDay ? `${formatDayLabel(h.busiestDay.date)}` : "—"}
              detail={h.busiestDay ? `${formatHms(h.busiestDay.seconds)} · média ${formatHms(h.averageSecondsPerActiveDay)} por dia com registro` : undefined}
              text
            />
          </div>

          <ReportChartsSection charts={charts} activityTitle="Principais descrições" showPeople={isAdmin} />
        </>
      )}
    </section>
  );
}

const topDetail = (item: TopItem | null, withClient = true) =>
  item ? `${withClient && item.sublabel ? `${item.sublabel} · ` : ""}${formatHms(item.seconds)} · ${formatPercent(item.percent)}` : undefined;

/** A headline figure. The total is a number (monospaced); the others are names, so they wrap and stay in the sans face. */
function Tile({ label, value, detail, text }: { label: string; value: string; detail?: string; text?: boolean }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={text ? "mt-0.5 break-words text-lg font-semibold leading-snug" : "font-mono text-2xl font-semibold tabular-nums"}>{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}
