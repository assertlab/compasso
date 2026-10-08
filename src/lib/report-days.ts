import { weekStart } from "./entry-groups";
import type { ReportRow } from "./report";
import { NO_PROJECT_LABEL } from "./report";
import { addDays, localDateString } from "./time";

/** Up to this many days the matrix has one column per day; longer periods get one column per week. */
export const MAX_DAY_COLUMNS = 31;

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const dm = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

export type DayColumn = {
  /** The local date (day view) or the Monday of the week (week view). */
  key: string;
  label: string;
  sublabel: string;
};

export type DayRow = {
  id: string;
  /** Project name, or the person's name on a person row. */
  label: string;
  /** Client name on a project row. */
  sublabel: string | null;
  /** 0 = project, 1 = person under a project. */
  level: 0 | 1;
  /** Seconds per column, same order as `columns`. */
  cells: number[];
  total: number;
};

export type DayMatrix = {
  granularity: "dia" | "semana";
  columns: DayColumn[];
  rows: DayRow[];
  /** Column totals (project rows only, so they add up to the grand total). */
  totals: number[];
  grandTotal: number;
};

/** Column keys for the period: every day, or every Monday when the period is too long for one column per day. */
export function dayColumns(fromDate: string, toDate: string): { granularity: DayMatrix["granularity"]; columns: DayColumn[] } {
  const days: string[] = [];
  for (let d = fromDate; d <= toDate; d = addDays(d, 1)) days.push(d);

  if (days.length <= MAX_DAY_COLUMNS) {
    return {
      granularity: "dia",
      columns: days.map((d) => ({ key: d, label: dm(d), sublabel: WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()] })),
    };
  }
  const weeks: DayColumn[] = [];
  for (let w = weekStart(fromDate); w <= toDate; w = addDays(w, 7)) {
    weeks.push({ key: w, label: dm(w), sublabel: `a ${dm(addDays(w, 6))}` });
  }
  return { granularity: "semana", columns: weeks };
}

const byName = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });

/**
 * Hours per project (and per person when `includePeople`) across the period's days or weeks, the way
 * Clockify's weekly report reads. Each entry counts on the local day it started (same rule as the rest of
 * the report), in the column that contains that day. Rows are ordered by client then project, with
 * "Sem projeto" last; column totals add up to the grand total.
 */
export function buildDayMatrix(
  rows: ReportRow[],
  period: { fromDate: string; toDate: string },
  timeZone: string,
  opts: { includePeople: boolean },
): DayMatrix {
  const { granularity, columns } = dayColumns(period.fromDate, period.toDate);
  const index = new Map(columns.map((c, i) => [c.key, i]));
  const zeros = () => columns.map(() => 0);

  type Project = { id: string; label: string; client: string | null; cells: number[]; total: number; people: Map<string, DayRow> };
  const projects = new Map<string, Project>();
  const totals = zeros();
  let grandTotal = 0;

  for (const r of rows) {
    const day = localDateString(r.startedAt, timeZone);
    const col = index.get(granularity === "dia" ? day : weekStart(day));
    if (col === undefined) continue; // outside the period (cannot happen for loader output; guards stray rows)

    const key = r.projectId ?? "none";
    let project = projects.get(key);
    if (!project) {
      project = {
        id: key,
        label: r.projectId ? (r.projectName ?? "—") : NO_PROJECT_LABEL,
        client: r.projectId ? r.clientName : null,
        cells: zeros(),
        total: 0,
        people: new Map(),
      };
      projects.set(key, project);
    }
    project.cells[col] += r.seconds;
    project.total += r.seconds;
    totals[col] += r.seconds;
    grandTotal += r.seconds;

    let person = project.people.get(r.userId);
    if (!person) {
      person = { id: `${key}:${r.userId}`, label: r.userName, sublabel: null, level: 1, cells: zeros(), total: 0 };
      project.people.set(r.userId, person);
    }
    person.cells[col] += r.seconds;
    person.total += r.seconds;
  }

  const ordered = [...projects.values()].sort((a, b) =>
    a.id === "none" ? 1 : b.id === "none" ? -1 : byName(a.client ?? "", b.client ?? "") || byName(a.label, b.label),
  );
  const out: DayRow[] = [];
  for (const p of ordered) {
    out.push({ id: p.id, label: p.label, sublabel: p.client, level: 0, cells: p.cells, total: p.total });
    if (opts.includePeople && p.people.size > 1) out.push(...[...p.people.values()].sort((a, b) => byName(a.label, b.label)));
  }
  return { granularity, columns, rows: out, totals, grandTotal };
}

/** "7:15" (minutes rounded), used where 31 columns must fit on a page; exact values stay in the spreadsheet. */
export function formatHm(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}
