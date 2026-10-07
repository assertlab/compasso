/** Pure layout for the week grid: where each entry sits inside a day column, and side-by-side lanes for overlaps. */

export const MIN_BLOCK_MINUTES = 15;
export const SNAP_MINUTES = 15;

export type CalendarEntry = { id: string; startedAt: string; endedAt: string | null };

export type Block<T> = {
  entry: T;
  /** Minutes elapsed since the day started, clipped to the day. */
  startMin: number;
  endMin: number;
  /** 0-based lane among overlapping blocks and how many lanes the overlap cluster needs. */
  lane: number;
  lanes: number;
  /** The entry continues past the end / came from before the start of this day. */
  continuesAfter: boolean;
  continuesBefore: boolean;
};

/**
 * Blocks of one day. `dayStart`/`dayEnd` are the day's UTC bounds (23-25 h on DST days).
 * A running entry ends at `now`. Entries crossing midnight are clipped, and tiny ones are
 * drawn at least MIN_BLOCK_MINUTES tall (so they stay clickable and overlap honestly).
 */
export function layoutDay<T extends CalendarEntry>(entries: T[], dayStart: Date, dayEnd: Date, now: Date): Block<T>[] {
  const dayMinutes = (dayEnd.getTime() - dayStart.getTime()) / 60_000;
  const raw = entries.flatMap((entry) => {
    const start = new Date(entry.startedAt);
    const end = entry.endedAt ? new Date(entry.endedAt) : now;
    const s = Math.max(start.getTime(), dayStart.getTime());
    const e = Math.min(end.getTime(), dayEnd.getTime());
    if (e <= s) return [];
    const startMin = (s - dayStart.getTime()) / 60_000;
    const endMin = Math.min(Math.max((e - dayStart.getTime()) / 60_000, startMin + MIN_BLOCK_MINUTES), dayMinutes);
    return [{ entry, startMin, endMin, continuesBefore: start < dayStart, continuesAfter: end > dayEnd }];
  });
  raw.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const blocks: Block<T>[] = [];
  let cluster: Block<T>[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];

  const flush = () => {
    for (const b of cluster) b.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };

  for (const r of raw) {
    if (r.startMin >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    let lane = laneEnds.findIndex((end) => end <= r.startMin);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = r.endMin;
    clusterEnd = Math.max(clusterEnd, r.endMin);
    const block: Block<T> = { ...r, lane, lanes: 1 };
    cluster.push(block);
    blocks.push(block);
  }
  flush();
  return blocks;
}

/** Rounds minutes to the nearest grid step. */
export const snapMinutes = (minutes: number, step = SNAP_MINUTES) => Math.round(minutes / step) * step;

/** "HH:MM" for minutes since midnight; 1440 becomes "00:00" (the end of the day reads as the next midnight). */
export function minutesToTime(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
