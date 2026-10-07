import { addDays, zonedMidnightUtc } from "./time";
import { weekStart } from "./entry-groups";

export const PERIOD_PRESETS = ["mes", "mes-anterior", "semana", "semana-anterior", "60", "90", "custom"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  mes: "Mês atual",
  "mes-anterior": "Mês anterior",
  semana: "Semana atual",
  "semana-anterior": "Semana anterior",
  "60": "Últimos 60 dias",
  "90": "Últimos 90 dias",
  custom: "Personalizado",
};

/** Longest custom range accepted, to keep a report (and its export) bounded. */
export const MAX_RANGE_DAYS = 366;

export type ResolvedPeriod = {
  /** First local day, inclusive ("YYYY-MM-DD"). */
  fromDate: string;
  /** Last local day, inclusive. */
  toDate: string;
  /** Half-open UTC range [from, to) covering those local days. */
  from: Date;
  to: Date;
};

const firstOfMonth = (date: string) => `${date.slice(0, 7)}-01`;
const lastOfPreviousMonth = (date: string) => addDays(firstOfMonth(date), -1);

/**
 * Turns a preset into a local-day range. `today` is the caller's local date.
 * "60"/"90" are rolling windows that end today (today counts as one of the days).
 * Returns an error message for an invalid custom range.
 */
export function resolvePeriod(
  preset: PeriodPreset,
  today: string,
  timeZone: string,
  custom?: { from?: string; to?: string },
): ResolvedPeriod | { error: string } {
  let fromDate: string;
  let toDate: string;
  switch (preset) {
    case "mes":
      fromDate = firstOfMonth(today);
      toDate = today;
      break;
    case "mes-anterior":
      toDate = lastOfPreviousMonth(today);
      fromDate = firstOfMonth(toDate);
      break;
    case "semana":
      fromDate = weekStart(today);
      toDate = today;
      break;
    case "semana-anterior":
      fromDate = addDays(weekStart(today), -7);
      toDate = addDays(fromDate, 6);
      break;
    case "60":
      fromDate = addDays(today, -59);
      toDate = today;
      break;
    case "90":
      fromDate = addDays(today, -89);
      toDate = today;
      break;
    case "custom": {
      if (!custom?.from || !custom?.to) return { error: "Informe as datas inicial e final." };
      fromDate = custom.from;
      toDate = custom.to;
      if (fromDate > toDate) return { error: "A data inicial deve ser anterior ou igual à final." };
      if (addDays(fromDate, MAX_RANGE_DAYS) <= toDate) return { error: `O período máximo é de ${MAX_RANGE_DAYS} dias.` };
      break;
    }
  }
  return { fromDate, toDate, from: zonedMidnightUtc(fromDate, timeZone), to: zonedMidnightUtc(addDays(toDate, 1), timeZone) };
}
