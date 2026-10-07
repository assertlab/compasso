import type { NextRequest } from "next/server";
import { buildCsv, describeFilters, EXPORT_FORMATS, exportFileName, formatDateBr, toExportRows, type ExportFormat } from "@/lib/report-export";
import { summarize } from "@/lib/report";
import { getTenant } from "@/server/get-tenant";
import { buildXlsx } from "@/server/report-xlsx";
import { loadCatalog } from "../../views";
import { loadReport } from "../load-report";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Repeated params (`pessoas`) become arrays, the rest stay strings. */
function paramsToRecord(params: URLSearchParams): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    out[key] = all.length > 1 ? all : all[0];
  }
  return out;
}

/**
 * GET /relatorios/export?formato=xlsx|csv&<same filters as the page>. Same loader as the page, so the file
 * always matches the screen; members are restricted to their own hours by the data layer, not here.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const format = params.get("formato") as ExportFormat | null;
  if (!format || !EXPORT_FORMATS.includes(format)) return new Response("Formato inválido.", { status: 400 });

  const { ctx, tenant } = await getTenant();
  const [report, catalog] = await Promise.all([loadReport(tenant, ctx, paramsToRecord(params)), loadCatalog(tenant)]);
  if (report.periodError) return new Response(report.periodError, { status: 400 });

  const rows = toExportRows(report.rows, ctx.timezone);
  const fileName = exportFileName(report.period.fromDate, report.period.toDate, format);
  const headers = {
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (format === "csv") {
    return new Response(buildCsv(rows, { includePerson: report.isAdmin }), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  }

  const file = await buildXlsx({
    period: `${formatDateBr(report.period.fromDate)} a ${formatDateBr(report.period.toDate)}`,
    filters: describeFilters(report.query, catalog, report.people),
    generatedAt: new Date(),
    includePerson: report.isAdmin,
    summary: summarize(report.rows),
    rows,
  });
  return new Response(file as BodyInit, { headers: { ...headers, "Content-Type": XLSX_TYPE } });
}
