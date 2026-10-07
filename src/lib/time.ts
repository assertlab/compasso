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

/** Offset (ms) of `timeZone` from UTC at the given instant: local wall clock minus UTC. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseLocalDate(date: string): [number, number, number] {
  const m = DATE_RE.exec(date);
  if (!m) throw new RangeError(`Invalid date "${date}", expected YYYY-MM-DD`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** The UTC instant of wall-clock `date` ("YYYY-MM-DD") + `time` ("HH:MM") in `timeZone` (DST-safe; wall times skipped by a DST jump are not specially handled). */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = parseLocalDate(date);
  const t = TIME_RE.exec(time);
  if (!t) throw new RangeError(`Invalid time "${time}", expected HH:MM`);
  const wall = Date.UTC(y, m - 1, d, Number(t[1]), Number(t[2]));
  // Two passes: the offset at the first guess may differ from the offset at the real instant around DST changes.
  const first = wall - zoneOffsetMs(new Date(wall), timeZone);
  return new Date(wall - zoneOffsetMs(new Date(first), timeZone));
}

/** The UTC instant at which the local calendar day `date` ("YYYY-MM-DD") starts in `timeZone`. */
export function zonedMidnightUtc(date: string, timeZone: string): Date {
  return zonedTimeToUtc(date, "00:00", timeZone);
}

/** Calendar arithmetic on "YYYY-MM-DD" strings (no time zone involved). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = parseLocalDate(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The local wall-clock time ("HH:MM") of an instant in `timeZone`. */
export function localTimeString(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("hour")}:${get("minute")}`;
}

/** Half-open UTC range [from, to) covering the local calendar day `date` in `timeZone` (23, 24 or 25 hours long). */
export function zonedDayRange(date: string, timeZone: string): { from: Date; to: Date } {
  return { from: zonedMidnightUtc(date, timeZone), to: zonedMidnightUtc(addDays(date, 1), timeZone) };
}

/** The local calendar date ("YYYY-MM-DD") of an instant in `timeZone`. */
export function localDateString(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
