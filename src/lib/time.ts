/**
 * Time helpers. Durations are never stored: they are derived from
 * (endedAt - startedAt), in whole seconds.
 */

export function entryDurationSeconds(
  startedAt: Date,
  endedAt: Date | null,
  now: Date = new Date(),
): number {
  const end = endedAt ?? now;
  const ms = end.getTime() - startedAt.getTime();
  if (ms < 0) {
    throw new RangeError("endedAt must not be before startedAt");
  }
  return Math.floor(ms / 1000);
}

/** "HH:MM:SS" with hours that may exceed 24. */
export function formatHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/** Decimal hours rounded to 2 places, as exported to spreadsheets (real number, never text). */
export function toDecimalHours(totalSeconds: number): number {
  return Math.round(totalSeconds / 36) / 100;
}
