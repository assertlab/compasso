import type { ReportRow } from "./report";
import { addDays, localDateString } from "./time";

const SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const LONG = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export type WeekdayBar = {
  /** 0 = Sunday ... 6 = Saturday (the chart axis runs Sunday to Saturday). */
  weekday: number;
  label: string;
  name: string;
  /** Hours logged on this weekday across the whole period. */
  totalSeconds: number;
  /** How many of this weekday fall in the period, up to today (days without entries count). */
  days: number;
  /** `totalSeconds / days`, rounded to the second. */
  averageSeconds: number;
};

export type WeekdayChart = {
  bars: WeekdayBar[];
  /** True when some weekday occurs at least twice, i.e. the average can differ from the total. */
  hasAverage: boolean;
};

const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/**
 * Hours per day of the week (Sunday to Saturday) over the period, as a total and as an average per day.
 * Each entry counts on the local day it started (same rule as the rest of the report). The average divides
 * by every such weekday in the period that has already happened (`today` caps the period, so the current
 * month's future days do not drag it down); days without entries count as zero. Pure: `today` is a local
 * "YYYY-MM-DD" passed in.
 */
export function buildWeekdayChart(
  rows: ReportRow[],
  period: { fromDate: string; toDate: string },
  timeZone: string,
  today: string,
): WeekdayChart {
  const totals = Array.from({ length: 7 }, () => 0);
  const counts = Array.from({ length: 7 }, () => 0);

  const last = today < period.toDate ? today : period.toDate;
  for (let d = period.fromDate; d <= last; d = addDays(d, 1)) counts[weekdayOf(d)] += 1;
  for (const r of rows) totals[weekdayOf(localDateString(r.startedAt, timeZone))] += r.seconds;

  const bars = totals.map((totalSeconds, weekday): WeekdayBar => {
    const days = counts[weekday];
    // days is 0 only for a weekday that has not happened yet (nothing logged on it, barring clock skew).
    return { weekday, label: SHORT[weekday], name: LONG[weekday], totalSeconds, days, averageSeconds: days > 0 ? Math.round(totalSeconds / days) : totalSeconds };
  });
  return { bars, hasAverage: counts.some((c) => c >= 2) };
}
