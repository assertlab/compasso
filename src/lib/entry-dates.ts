import { addDays } from "./time";

/**
 * The end day implied by the start day and the two wall-clock times: the same day, or the next one
 * when the end time is not after the start time (a 20:00 to 01:30 shift). Used as the default of the
 * "end date" field and as the fallback when a request carries no end date.
 */
export function impliedEndDate(date: string, start: string, end: string): string {
  return start && end && end <= start ? addDays(date, 1) : date;
}
