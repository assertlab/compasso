import { formatHms, localDateString, localTimeString, toDecimalHours } from "./time";
import type { ReportRow } from "./report";
import type { ReportQuery } from "./schemas/report";

export const EXPORT_FORMATS = ["xlsx", "csv"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** One report line in the caller's local time, shared by every export format. */
export type ExportRow = {
  /** Local calendar day the entry started ("YYYY-MM-DD"). */
  date: string;
  /** Local wall-clock times "HH:MM". */
  start: string;
  end: string;
  seconds: number;
  person: string;
  client: string;
  project: string;
  task: string;
  description: string;
};

export function toExportRows(rows: ReportRow[], timeZone: string): ExportRow[] {
  return rows.map((r) => ({
    date: localDateString(r.startedAt, timeZone),
    start: localTimeString(r.startedAt, timeZone),
    end: localTimeString(r.endedAt, timeZone),
    seconds: r.seconds,
    person: r.userName,
    client: r.projectId ? (r.clientName ?? "") : "",
    project: r.projectName ?? "Sem projeto",
    task: r.taskName ?? "",
    description: r.description,
  }));
}

/** "2026-02-03" -> "03/02/2026". */
export const formatDateBr = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

/**
 * A spreadsheet treats a cell that starts with = + - @ (or a tab/CR) as a formula. Descriptions and names
 * are user-typed and an admin opens other people's exports, so such text gets a leading apostrophe (OWASP CSV injection).
 */
const neutralizeFormula = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);

const DELIMITER = ";";

/** Quotes a text cell for CSV (and neutralizes formulas). */
export function csvCell(value: string): string {
  const safe = neutralizeFormula(value);
  return /[";\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/**
 * CSV for Excel in pt-BR: UTF-8 with BOM, ";" separator, CRLF, decimal comma. Hours are the same
 * 2-decimal value used elsewhere; the duration column keeps the exact HH:MM:SS.
 */
export function buildCsv(rows: ExportRow[], opts: { includePerson: boolean }): string {
  const header = ["Data", "Início", "Fim", "Duração", "Horas", ...(opts.includePerson ? ["Pessoa"] : []), "Cliente", "Projeto", "Tarefa", "Descrição"];
  const lines = [header.map(csvCell).join(DELIMITER)];
  for (const r of rows) {
    lines.push(
      [
        formatDateBr(r.date),
        r.start,
        r.end,
        formatHms(r.seconds),
        toDecimalHours(r.seconds).toFixed(2).replace(".", ","),
        ...(opts.includePerson ? [csvCell(r.person)] : []),
        csvCell(r.client),
        csvCell(r.project),
        csvCell(r.task),
        csvCell(r.description),
      ].join(DELIMITER),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

type NamedCatalog = {
  organizations: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  tasks: { id: string; name: string }[];
};

/** Human-readable filter lines for the header of an export ("Cliente: ASSERT Lab"). Only filters that are set. */
export function describeFilters(query: ReportQuery, catalog: NamedCatalog, people: { id: string; name: string }[] | null): string[] {
  const lines: string[] = [];
  if (query.projeto === "none") lines.push("Projeto: Sem projeto");
  else {
    if (query.cliente) lines.push(`Cliente: ${catalog.organizations.find((o) => o.id === query.cliente)?.name ?? "—"}`);
    if (query.projeto) lines.push(`Projeto: ${catalog.projects.find((p) => p.id === query.projeto)?.name ?? "—"}`);
    if (query.tarefa) lines.push(`Tarefa: ${catalog.tasks.find((t) => t.id === query.tarefa)?.name ?? "—"}`);
  }
  if (people && query.pessoas.length > 0) {
    lines.push(`Pessoas: ${query.pessoas.map((id) => people.find((p) => p.id === id)?.name ?? "—").join(", ")}`);
  }
  return lines;
}

/** Safe ASCII file name: compasso-horas_2026-02-01_2026-02-28.xlsx */
export const exportFileName = (fromDate: string, toDate: string, format: ExportFormat) => `compasso-horas_${fromDate}_${toDate}.${format}`;
