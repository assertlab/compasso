import { describe, expect, it } from "vitest";
import { layoutDay, minutesToTime, snapMinutes } from "./calendar-layout";

const dayStart = new Date("2026-10-07T03:00:00Z"); // midnight in Recife
const dayEnd = new Date("2026-10-08T03:00:00Z");
const now = new Date("2026-10-07T15:00:00Z"); // 12:00 local
let n = 0;
const e = (start: string, end: string | null) => ({ id: `e${++n}`, startedAt: start, endedAt: end });
const layout = (items: ReturnType<typeof e>[]) => layoutDay(items, dayStart, dayEnd, now);

describe("layoutDay", () => {
  it("positions a block by minutes since the start of the local day", () => {
    const [b] = layout([e("2026-10-07T11:00:00Z", "2026-10-07T12:30:00Z")]); // 08:00-09:30 local
    expect(b).toMatchObject({ startMin: 480, endMin: 570, lane: 0, lanes: 1 });
  });

  it("puts overlapping entries side by side and gives a later, free slot the whole width back", () => {
    const blocks = layout([
      e("2026-10-07T11:00:00Z", "2026-10-07T13:00:00Z"), // 08:00-10:00
      e("2026-10-07T12:00:00Z", "2026-10-07T14:00:00Z"), // 09:00-11:00
      e("2026-10-07T15:00:00Z", "2026-10-07T16:00:00Z"), // 12:00-13:00, alone
    ]);
    expect(blocks.map((b) => [b.lane, b.lanes])).toEqual([[0, 2], [1, 2], [0, 1]]);
  });

  it("reuses a lane once its previous block has ended within the same cluster", () => {
    const blocks = layout([
      e("2026-10-07T11:00:00Z", "2026-10-07T15:00:00Z"), // 08:00-12:00 (long)
      e("2026-10-07T11:00:00Z", "2026-10-07T12:00:00Z"), // 08:00-09:00
      e("2026-10-07T12:00:00Z", "2026-10-07T13:00:00Z"), // 09:00-10:00 reuses lane 1
    ]);
    expect(blocks.map((b) => b.lane)).toEqual([0, 1, 1]);
    expect(blocks.every((b) => b.lanes === 2)).toBe(true);
  });

  it("does not treat back-to-back entries as overlapping", () => {
    const blocks = layout([e("2026-10-07T11:00:00Z", "2026-10-07T12:00:00Z"), e("2026-10-07T12:00:00Z", "2026-10-07T13:00:00Z")]);
    expect(blocks.map((b) => [b.lane, b.lanes])).toEqual([[0, 1], [0, 1]]);
  });

  it("clips entries that cross midnight and flags the continuation", () => {
    const [late] = layout([e("2026-10-07T23:00:00Z", "2026-10-08T05:00:00Z")]); // 20:00 -> 02:00 next day
    expect(late).toMatchObject({ startMin: 1200, endMin: 1440, continuesAfter: true, continuesBefore: false });
    const [early] = layoutDay([e("2026-10-07T01:00:00Z", "2026-10-07T05:00:00Z")], dayStart, dayEnd, now); // 22:00 prev day -> 02:00
    expect(early).toMatchObject({ startMin: 0, endMin: 120, continuesBefore: true });
  });

  it("ends a running entry at now and skips entries outside the day", () => {
    const [run] = layout([e("2026-10-07T14:00:00Z", null)]); // 11:00 -> now 12:00
    expect(run).toMatchObject({ startMin: 480 + 180, endMin: 720 });
    expect(layout([e("2026-10-06T11:00:00Z", "2026-10-06T12:00:00Z")])).toEqual([]);
  });

  it("draws very short entries at the minimum height", () => {
    const [b] = layout([e("2026-10-07T11:00:00Z", "2026-10-07T11:00:20Z")]);
    expect(b.endMin - b.startMin).toBe(15);
  });
});

describe("grid helpers", () => {
  it("snaps to 15 minutes", () => {
    expect(snapMinutes(7)).toBe(0);
    expect(snapMinutes(8)).toBe(15);
    expect(snapMinutes(487)).toBe(480);
  });

  it("formats minutes as HH:MM, with the end of the day as 00:00", () => {
    expect(minutesToTime(0)).toBe("00:00");
    expect(minutesToTime(570)).toBe("09:30");
    expect(minutesToTime(1440)).toBe("00:00");
  });
});
