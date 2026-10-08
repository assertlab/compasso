import type { ReportRow, ReportSummary } from "./report";
import { localDateString } from "./time";

export type TopItem = { label: string; sublabel: string | null; seconds: number; /** 0-100, share of the period total */ percent: number };

export type Highlights = {
  totalSeconds: number;
  totalEntries: number;
  /** Local days with at least one finished entry. */
  activeDays: number;
  /** Total divided by active days (0 when nothing was tracked). */
  averageSecondsPerActiveDay: number;
  /** Largest project / client with a real name ("Sem projeto" never counts as a highlight). */
  topProject: TopItem | null;
  topClient: TopItem | null;
  busiestDay: { date: string; seconds: number } | null;
};

const share = (seconds: number, total: number) => (total > 0 ? (seconds / total) * 100 : 0);

/** The few numbers the dashboard leads with, derived from rows the report already loaded. Ties go to the first by name order. */
export function buildHighlights(rows: ReportRow[], summary: ReportSummary, timeZone: string): Highlights {
  const total = summary.totalSeconds;

  let topProject: TopItem | null = null;
  let topClient: TopItem | null = null;
  for (const client of summary.clients) {
    if (client.id === null) continue;
    if (!topClient || client.seconds > topClient.seconds) {
      topClient = { label: client.name, sublabel: null, seconds: client.seconds, percent: share(client.seconds, total) };
    }
    for (const project of client.projects) {
      if (project.id === null) continue;
      if (!topProject || project.seconds > topProject.seconds) {
        topProject = { label: project.name, sublabel: client.name, seconds: project.seconds, percent: share(project.seconds, total) };
      }
    }
  }

  const perDay = new Map<string, number>();
  for (const r of rows) {
    const day = localDateString(r.startedAt, timeZone);
    perDay.set(day, (perDay.get(day) ?? 0) + r.seconds);
  }
  let busiestDay: Highlights["busiestDay"] = null;
  for (const [date, seconds] of [...perDay].sort(([a], [b]) => a.localeCompare(b))) {
    if (!busiestDay || seconds > busiestDay.seconds) busiestDay = { date, seconds };
  }

  const activeDays = perDay.size;
  return {
    totalSeconds: total,
    totalEntries: summary.totalEntries,
    activeDays,
    averageSecondsPerActiveDay: activeDays > 0 ? Math.round(total / activeDays) : 0,
    topProject: topProject?.seconds ? topProject : null,
    topClient: topClient?.seconds ? topClient : null,
    busiestDay,
  };
}
