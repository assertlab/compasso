import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDayLabel } from "@/lib/entry-groups";
import { PERIOD_LABELS, resolvePeriod, type ResolvedPeriod } from "@/lib/report-period";
import { summarize } from "@/lib/report";
import { parseReportQuery } from "@/lib/schemas/report";
import { formatHms, localDateString, localTimeString } from "@/lib/time";
import { getTenant } from "@/server/get-tenant";
import { loadCatalog } from "../views";
import { ReportFilters } from "./report-filters";

export const metadata: Metadata = { title: "Relatórios" };

/** The detail table is capped on screen; the export (next step) carries every row. */
const MAX_TABLE_ROWS = 500;

export default function ReportsPage({ searchParams }: PageProps<"/relatorios">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" aria-hidden />}>
      <Reports searchParams={searchParams} />
    </Suspense>
  );
}

async function Reports({ searchParams }: Pick<PageProps<"/relatorios">, "searchParams">) {
  const query = parseReportQuery(await searchParams);
  const { ctx, tenant } = await getTenant();
  const tz = ctx.timezone;
  const today = localDateString(new Date(), tz);

  const resolved = resolvePeriod(query.periodo, today, tz, { from: query.de, to: query.ate });
  const periodError = "error" in resolved ? resolved.error : null;
  const period: ResolvedPeriod = "error" in resolved ? (resolvePeriod("mes", today, tz) as ResolvedPeriod) : resolved;

  const isAdmin = ctx.role === "admin";
  const [catalog, people, result] = await Promise.all([
    loadCatalog(tenant),
    isAdmin ? tenant.reports.people() : Promise.resolve(null),
    tenant.reports.run({
      from: period.from,
      to: period.to,
      clientId: query.cliente,
      projectId: query.projeto,
      taskId: query.tarefa,
      userIds: isAdmin ? query.pessoas : undefined,
    }),
  ]);
  const summary = summarize(result.rows);
  const showPerson = isAdmin;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          {PERIOD_LABELS[periodError ? "mes" : query.periodo]}: {formatDayLabel(period.fromDate)} {period.fromDate.slice(0, 4)} –{" "}
          {formatDayLabel(period.toDate)} {period.toDate.slice(0, 4)}
          {!isAdmin && " · apenas os seus registros"}
        </p>
      </div>

      <ReportFilters catalog={catalog} people={people} query={query} />

      {periodError && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {periodError} Mostrando o mês atual.
        </p>
      )}
      {result.runningCount > 0 && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {result.runningCount === 1 ? "Há 1 timer em andamento" : `Há ${result.runningCount} timers em andamento`} neste período. Ele só entra no relatório depois de parado.
        </p>
      )}

      {summary.totalEntries === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum registro encontrado com esses filtros.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Total de horas" value={formatHms(summary.totalSeconds)} />
            <Stat label="Registros" value={String(summary.totalEntries)} />
            <Stat label={showPerson ? "Pessoas" : "Clientes"} value={String(showPerson ? summary.people.length : summary.clients.length)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Por cliente, projeto e tarefa</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {summary.clients.map((c) => (
                <div key={c.id ?? "none"} className="grid gap-1">
                  <Line strong label={c.name} seconds={c.seconds} entries={c.entries} />
                  {c.projects.map((p) => (
                    <div key={p.id ?? "none"} className="ml-4 grid gap-0.5">
                      {c.id !== null && <Line label={p.name} seconds={p.seconds} entries={p.entries} />}
                      {c.id !== null &&
                        p.tasks.map((t) => (
                          <div key={t.id ?? "none"} className="ml-4">
                            <Line muted label={t.name} seconds={t.seconds} entries={t.entries} />
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>

          {showPerson && summary.people.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por pessoa</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1">
                {summary.people.map((p) => (
                  <Line key={p.id} label={p.name} seconds={p.seconds} entries={p.entries} />
                ))}
              </CardContent>
            </Card>
          )}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  {showPerson && <TableHead>Pessoa</TableHead>}
                  <TableHead>Cliente / projeto / tarefa</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Início–fim</TableHead>
                  <TableHead className="text-right">Duração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.slice(0, MAX_TABLE_ROWS).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{formatDayLabel(localDateString(r.startedAt, tz))}</TableCell>
                    {showPerson && <TableCell>{r.userName}</TableCell>}
                    <TableCell>{[r.clientName, r.projectName, r.taskName].filter(Boolean).join(" / ") || "Sem projeto"}</TableCell>
                    <TableCell className="max-w-xs truncate">{r.description || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">
                      {localTimeString(r.startedAt, tz)}–{localTimeString(r.endedAt, tz)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatHms(r.seconds)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {result.rows.length > MAX_TABLE_ROWS && (
            <p className="text-sm text-muted-foreground">
              Mostrando os {MAX_TABLE_ROWS} registros mais recentes de {result.rows.length}. Os totais acima consideram todos.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-mono text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Line({ label, seconds, entries, strong, muted }: { label: string; seconds: number; entries: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "border-b pb-1 font-semibold" : ""} ${muted ? "text-sm text-muted-foreground" : ""}`}>
      <span className="truncate">{label}</span>
      <span className="whitespace-nowrap font-mono tabular-nums">
        {formatHms(seconds)} <span className="ml-2 font-sans text-xs text-muted-foreground">{entries}</span>
      </span>
    </div>
  );
}
