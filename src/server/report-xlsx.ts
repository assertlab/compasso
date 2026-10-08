import ExcelJS from "exceljs";
import type { ExportRow } from "@/lib/report-export";
import { GROUP_LABELS, type ReportSummary } from "@/lib/report";

const DAY = 86_400;
const FMT_DURATION = "[h]:mm:ss";
const FMT_HOURS = "0.00";

/** Excel stores dates as UTC-midnight serials; the local day string is used as is, with no zone involved. */
const dateCell = (date: string) => new Date(`${date}T00:00:00Z`);
const timeFraction = (hhmm: string) => (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))) / 1440;

const BOLD = { bold: true } as const;
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E2E47" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } };

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle" };
  });
}

/**
 * Two sheets: "Resumo" (client > project > task with subtotals, and per person for admins) and
 * "Registros" (one line per entry). Durations are real numbers (fractions of a day, shown as [h]:mm:ss) and
 * hours are real, un-rounded numbers shown with 2 decimals, so sums and pivots stay exact.
 */
export async function buildXlsx(input: {
  period: string;
  filters: string[];
  generatedAt: Date;
  includePerson: boolean;
  summary: ReportSummary;
  rows: ExportRow[];
}): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Compasso";
  wb.created = input.generatedAt;

  // ---- Resumo
  const sum = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
  sum.columns = [{ width: 46 }, { width: 12 }, { width: 14 }, { width: 10 }];
  sum.getCell("A1").value = "Relatório de horas";
  sum.getCell("A1").font = { bold: true, size: 14 };
  sum.getCell("A2").value = `Período: ${input.period}`;
  let r = 3;
  for (const line of input.filters) sum.getCell(`A${r++}`).value = line;
  sum.getCell(`A${r++}`).value = `Gerado em ${input.generatedAt.toISOString().slice(0, 10)} pelo Compasso`;
  r++;

  const header = sum.getRow(r++);
  header.values = [`Cliente / projeto / ${GROUP_LABELS[input.summary.groupBy].toLowerCase()}`, "Registros", "Duração", "Horas"];
  styleHeader(header);
  header.getCell(2).alignment = header.getCell(3).alignment = header.getCell(4).alignment = { horizontal: "right" };

  const line = (label: string, seconds: number, entries: number, indent: number, bold: boolean) => {
    const row = sum.getRow(r++);
    row.getCell(1).value = label;
    row.getCell(1).alignment = { indent };
    row.getCell(2).value = entries;
    row.getCell(3).value = seconds / DAY;
    row.getCell(3).numFmt = FMT_DURATION;
    row.getCell(4).value = seconds / 3600;
    row.getCell(4).numFmt = FMT_HOURS;
    if (bold) row.font = BOLD;
    return row;
  };

  for (const c of input.summary.clients) {
    line(c.name, c.seconds, c.entries, 0, true);
    // "Sem projeto" is a single synthetic client/project: no second level to show.
    if (c.id === null) continue;
    for (const p of c.projects) {
      line(p.name, p.seconds, p.entries, 1, false);
      for (const t of p.items) line(t.name, t.seconds, t.entries, 2, false).font = { color: { argb: "FF555555" } };
    }
  }
  const total = line("Total", input.summary.totalSeconds, input.summary.totalEntries, 0, true);
  total.eachCell((cell) => (cell.border = { top: { style: "thin" } }));

  if (input.includePerson && input.summary.people.length > 1) {
    r++;
    const ph = sum.getRow(r++);
    ph.values = ["Pessoa", "Registros", "Duração", "Horas"];
    styleHeader(ph);
    ph.getCell(2).alignment = ph.getCell(3).alignment = ph.getCell(4).alignment = { horizontal: "right" };
    for (const p of input.summary.people) line(p.name, p.seconds, p.entries, 0, false);
  }

  // ---- Registros
  const det = wb.addWorksheet("Registros", { views: [{ state: "frozen", ySplit: 1 }] });
  const columns = [
    { header: "Data de início", key: "date", width: 14 },
    { header: "Hora de início", key: "start", width: 14 },
    { header: "Data de término", key: "endDate", width: 16 },
    { header: "Hora de término", key: "end", width: 15 },
    { header: "Duração", key: "duration", width: 11 },
    { header: "Horas", key: "hours", width: 8 },
    ...(input.includePerson ? [{ header: "Pessoa", key: "person", width: 22 }] : []),
    { header: "Cliente", key: "client", width: 22 },
    { header: "Projeto", key: "project", width: 24 },
    { header: "Tarefa", key: "task", width: 28 },
    { header: "Descrição", key: "description", width: 48 },
  ];
  det.columns = columns;
  styleHeader(det.getRow(1));

  for (const e of input.rows) {
    det.addRow({
      date: dateCell(e.date),
      start: timeFraction(e.start),
      endDate: dateCell(e.endDate),
      end: timeFraction(e.end),
      duration: e.seconds / DAY,
      hours: e.seconds / 3600,
      person: e.person,
      client: e.client,
      project: e.project,
      task: e.task,
      description: e.description,
    });
  }
  det.getColumn("date").numFmt = "dd/mm/yyyy";
  det.getColumn("endDate").numFmt = "dd/mm/yyyy";
  det.getColumn("start").numFmt = "hh:mm";
  det.getColumn("end").numFmt = "hh:mm";
  det.getColumn("duration").numFmt = FMT_DURATION;
  det.getColumn("hours").numFmt = FMT_HOURS;

  const last = input.rows.length + 1;
  if (input.rows.length > 0) {
    det.autoFilter = { from: "A1", to: { row: last, column: columns.length } };
    const totals = det.addRow({});
    totals.getCell("date").value = "Total";
    totals.getCell("duration").value = { formula: `SUM(E2:E${last})`, result: input.summary.totalSeconds / DAY };
    totals.getCell("hours").value = { formula: `SUM(F2:F${last})`, result: input.summary.totalSeconds / 3600 };
    totals.font = BOLD;
    totals.eachCell((cell) => (cell.border = { top: { style: "thin" } }));
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
