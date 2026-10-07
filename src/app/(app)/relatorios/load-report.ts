import { PERIOD_LABELS, resolvePeriod, type PeriodPreset, type ResolvedPeriod } from "@/lib/report-period";
import type { ReportRow } from "@/lib/report";
import { parseReportQuery, type ReportQuery } from "@/lib/schemas/report";
import { localDateString } from "@/lib/time";
import type { Tenant, TenantContext } from "@/server/tenant";

export type LoadedReport = {
  query: ReportQuery;
  period: ResolvedPeriod;
  /** The preset actually applied (falls back to the current month when a custom range is invalid). */
  periodLabel: string;
  /** Message when the requested period was invalid; the current month is used instead. */
  periodError: string | null;
  rows: ReportRow[];
  runningCount: number;
  /** Entries without a project in the period, only computed when a client filter hides them. */
  unassignedCount: number;
  /** Everyone an admin may filter by; null for members. */
  people: { id: string; name: string; isRemoved: boolean }[] | null;
  isAdmin: boolean;
};

/** Shared by the report page and the export route so both always show the same numbers. */
export async function loadReport(tenant: Tenant, ctx: TenantContext, raw: Record<string, string | string[] | undefined>): Promise<LoadedReport> {
  const query = parseReportQuery(raw);
  const tz = ctx.timezone;
  const today = localDateString(new Date(), tz);

  const resolved = resolvePeriod(query.periodo, today, tz, { from: query.de, to: query.ate });
  const periodError = "error" in resolved ? resolved.error : null;
  const period = "error" in resolved ? (resolvePeriod("mes", today, tz) as ResolvedPeriod) : resolved;
  const preset: PeriodPreset = periodError ? "mes" : query.periodo;

  const isAdmin = ctx.role === "admin";
  const userIds = isAdmin ? query.pessoas : undefined;
  const clientFilterOnly = Boolean(query.cliente) && !query.projeto && !query.tarefa;

  const [people, result, unassigned] = await Promise.all([
    isAdmin ? tenant.reports.people() : Promise.resolve(null),
    tenant.reports.run({ from: period.from, to: period.to, clientId: query.cliente, projectId: query.projeto, taskId: query.tarefa, userIds }),
    clientFilterOnly ? tenant.reports.run({ from: period.from, to: period.to, projectId: "none", userIds }) : Promise.resolve(null),
  ]);

  return {
    query,
    period,
    periodLabel: PERIOD_LABELS[preset],
    periodError,
    rows: result.rows,
    runningCount: result.runningCount,
    unassignedCount: unassigned?.rows.length ?? 0,
    people,
    isAdmin,
  };
}
