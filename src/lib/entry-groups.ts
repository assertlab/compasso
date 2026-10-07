import { addDays } from "./time";

/** The fields grouping needs; the UI passes richer view models and gets them back untouched. */
export type Groupable = {
  id: string;
  description: string;
  projectId: string | null;
  taskId: string | null;
  /** Local calendar date ("YYYY-MM-DD") of the start, in the entry's user's time zone. */
  date: string;
  startedAt: string;
  /** Whole seconds, or null while the entry is running (counted as 0 in totals until it stops). */
  durationSeconds: number | null;
};

export type EntryGroup<T> = { key: string; entries: T[]; totalSeconds: number };
export type DayGroup<T> = { date: string; totalSeconds: number; groups: EntryGroup<T>[] };
export type WeekGroup<T> = { weekStart: string; totalSeconds: number; days: DayGroup<T>[] };

/** Monday of the week containing `date` ("YYYY-MM-DD"). Weeks start on Monday (ISO). */
export function weekStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

const seconds = (e: Groupable) => e.durationSeconds ?? 0;
const sum = (items: { totalSeconds: number }[]) => items.reduce((total, item) => total + item.totalSeconds, 0);

/**
 * Week > day > "same activity" groups, newest first, each level with its total.
 * Entries of one day with the same description, project and task form a group
 * (shown collapsed with a counter); every entry stays individually reachable.
 */
export function groupEntries<T extends Groupable>(entries: T[]): WeekGroup<T>[] {
  const newestFirst = [...entries].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const weeks = new Map<string, Map<string, Map<string, T[]>>>();

  for (const entry of newestFirst) {
    const week = weekStart(entry.date);
    const key = JSON.stringify([entry.description.trim().toLowerCase(), entry.projectId, entry.taskId]);
    const days = weeks.get(week) ?? new Map();
    const groups = days.get(entry.date) ?? new Map();
    groups.set(key, [...(groups.get(key) ?? []), entry]);
    days.set(entry.date, groups);
    weeks.set(week, days);
  }

  // Maps keep insertion order, which is already newest first at every level.
  return [...weeks].map(([week, days]) => {
    const dayGroups = [...days].map(([date, groups]) => {
      const groupList = [...groups].map(([key, list]) => ({ key, entries: list, totalSeconds: list.reduce((t, e) => t + seconds(e), 0) }));
      return { date, totalSeconds: sum(groupList), groups: groupList };
    });
    return { weekStart: week, totalSeconds: sum(dayGroups), days: dayGroups };
  });
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "Seg, 5 out" */
export function formatDayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} ${MONTHS[m - 1]}`;
}

/** "Esta semana", "Semana anterior" or "28 set – 4 out". */
export function formatWeekLabel(week: string, currentWeek: string): string {
  if (week === currentWeek) return "Esta semana";
  if (week === addDays(currentWeek, -7)) return "Semana anterior";
  const [, m1, d1] = week.split("-").map(Number);
  const end = addDays(week, 6);
  const [, m2, d2] = end.split("-").map(Number);
  return `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]}`;
}
