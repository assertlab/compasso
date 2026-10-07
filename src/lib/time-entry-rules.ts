/** Business rules for the time range of an entry. Pure, so they are shared by the data layer and the UI. */

export const MAX_ENTRY_MS = 24 * 3_600_000;
/** Clock skew between the browser and the server: an end up to this far ahead of `now` is accepted. */
export const FUTURE_TOLERANCE_MS = 60_000;

export type RangeProblem = "end_not_after_start" | "too_long" | "in_future";

export const rangeMessages: Record<RangeProblem, string> = {
  end_not_after_start: "O fim deve ser depois do início.",
  too_long: "Um registro não pode passar de 24 horas.",
  in_future: "O horário não pode estar no futuro.",
};

/** `endedAt = null` means a running timer: only the start is checked against the future. */
export function checkRange(startedAt: Date, endedAt: Date | null, now: Date): RangeProblem | null {
  if (startedAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) return "in_future";
  if (endedAt === null) return null;
  if (endedAt.getTime() <= startedAt.getTime()) return "end_not_after_start";
  if (endedAt.getTime() - startedAt.getTime() > MAX_ENTRY_MS) return "too_long";
  if (endedAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) return "in_future";
  return null;
}
