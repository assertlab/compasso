import type { DayMatrix } from "./report-days";
import type { ReportSummary } from "./report";

/** Ranked lists show this many entries; the rest fold into one "Outros" row so the chart stays readable. */
export const MAX_SHARE_ITEMS = 8;
export const MAX_ACTIVITY_ITEMS = 10;
export const OTHERS_ID = "others";

export type ShareItem = {
  id: string;
  label: string;
  /** Client name under a project; null elsewhere. */
  sublabel: string | null;
  seconds: number;
  /** Share of the grand total, 0-100 (unrounded). */
  percent: number;
};

export type BarItem = { key: string; label: string; sublabel: string; seconds: number };

export type ReportCharts = {
  granularity: DayMatrix["granularity"];
  bars: BarItem[];
  /** Tallest bar; at least 1 so an all-zero period never divides by zero. */
  barMax: number;
  projects: ShareItem[];
  /** Descriptions or tasks (per the summary's `groupBy`), merged across projects. */
  activities: ShareItem[];
  people: ShareItem[];
};

/** "<1%" for tiny non-zero shares so they never read as empty; whole percent otherwise. */
export function formatPercent(percent: number): string {
  if (percent <= 0) return "0%";
  if (percent < 1) return "<1%";
  return `${Math.round(percent)}%`;
}

/** Largest first (ties by name, for a stable order), cut at `limit`; the remainder becomes one "Outros (n)" item (never a lone item, which is shown as is). */
export function rankShares(items: Omit<ShareItem, "percent">[], totalSeconds: number, limit: number): ShareItem[] {
  const withPercent = (i: Omit<ShareItem, "percent">): ShareItem => ({ ...i, percent: totalSeconds > 0 ? (i.seconds / totalSeconds) * 100 : 0 });
  const sorted = items
    .filter((i) => i.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds || a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));
  if (sorted.length <= limit + 1) return sorted.map(withPercent);
  const rest = sorted.slice(limit);
  const others = { id: OTHERS_ID, label: `Outros (${rest.length})`, sublabel: null, seconds: rest.reduce((sum, i) => sum + i.seconds, 0) };
  return [...sorted.slice(0, limit).map(withPercent), withPercent(others)];
}

/** Everything the charts need, derived from data the report already has (no new queries). */
export function buildCharts(summary: ReportSummary, matrix: DayMatrix): ReportCharts {
  const total = summary.totalSeconds;

  const projects = rankShares(
    summary.clients.flatMap((c) =>
      c.projects.map((p) => ({
        id: `${c.id ?? "none"}:${p.id ?? "none"}`,
        label: p.name,
        sublabel: c.id === null ? null : c.name,
        seconds: p.seconds,
      })),
    ),
    total,
    MAX_SHARE_ITEMS,
  );

  const leaves = new Map<string, Omit<ShareItem, "percent">>();
  for (const c of summary.clients) {
    for (const p of c.projects) {
      for (const item of p.items) {
        const key = item.id ?? "none";
        const prev = leaves.get(key);
        if (prev) prev.seconds += item.seconds;
        else leaves.set(key, { id: key, label: item.name, sublabel: null, seconds: item.seconds });
      }
    }
  }
  const activities = rankShares([...leaves.values()], total, MAX_ACTIVITY_ITEMS);

  const people = rankShares(
    summary.people.map((p) => ({ id: p.id, label: p.name, sublabel: null, seconds: p.seconds })),
    total,
    MAX_SHARE_ITEMS,
  );

  const bars = matrix.columns.map((c, i) => ({ key: c.key, label: c.label, sublabel: c.sublabel, seconds: matrix.totals[i] ?? 0 }));
  return { granularity: matrix.granularity, bars, barMax: Math.max(1, ...bars.map((b) => b.seconds)), projects, activities, people };
}

const HOUR = 3600;
const TICK_STEPS_HOURS = [0.25, 0.5, 1, 2, 4, 5, 10, 20, 25, 50, 100, 200, 500, 1000];

/** Round, hour-based y ticks from 0 up to just above `maxSeconds` (at most ~4 intervals), in seconds. */
export function axisTicks(maxSeconds: number): number[] {
  const maxHours = Math.max(maxSeconds, HOUR / 4) / HOUR;
  const step = TICK_STEPS_HOURS.find((s) => maxHours / s <= 4) ?? TICK_STEPS_HOURS.at(-1)!;
  const ticks: number[] = [];
  for (let h = 0; h < maxHours + step; h += step) {
    ticks.push(Math.round(h * HOUR));
    if (h >= maxHours) break;
  }
  return ticks;
}

/** "2h", "1,5h", "0,25h": axis labels in hours, pt-BR decimal comma. */
export function formatAxisHours(seconds: number): string {
  return `${String(Math.round((seconds / HOUR) * 100) / 100).replace(".", ",")}h`;
}
