import { describe, expect, it } from "vitest";
import type { ReportRow } from "./report";
import { buildWeekdayChart } from "./report-weekdays";

const TZ = "America/Recife";
let n = 0;
/** An entry that started at `iso` (UTC) and lasted `seconds`. */
const row = (iso: string, seconds: number): ReportRow => {
  n += 1;
  const startedAt = new Date(iso);
  return {
    id: `r${n}`, userId: "u1", userName: "Ana", clientId: "c1", clientName: "Cliente A", projectId: "p1", projectName: "Projeto X",
    taskId: null, taskName: null, description: "x", startedAt, endedAt: new Date(startedAt.getTime() + seconds * 1000), seconds, corrected: false,
  };
};
const H = 3600;

describe("buildWeekdayChart", () => {
  it("lists Sunday to Saturday", () => {
    const { bars } = buildWeekdayChart([], { fromDate: "2026-10-04", toDate: "2026-10-10" }, TZ, "2026-10-20");
    expect(bars.map((b) => b.label)).toEqual(["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]);
    expect(bars[0].weekday).toBe(0);
  });

  it("one week: the total per weekday, no separate average", () => {
    // 2026-10-04 is a Sunday; 10-06 a Tuesday; 10-10 a Saturday.
    const rows = [row("2026-10-06T13:00:00Z", 2 * H), row("2026-10-06T18:00:00Z", H), row("2026-10-10T13:00:00Z", 4 * H)];
    const chart = buildWeekdayChart(rows, { fromDate: "2026-10-04", toDate: "2026-10-10" }, TZ, "2026-10-20");
    expect(chart.hasAverage).toBe(false);
    expect(chart.bars[2]).toMatchObject({ name: "terça-feira", totalSeconds: 3 * H, days: 1, averageSeconds: 3 * H });
    expect(chart.bars[6]).toMatchObject({ totalSeconds: 4 * H, days: 1 });
    expect(chart.bars[1].totalSeconds).toBe(0);
  });

  it("several weeks: the average divides by every such weekday of the period, empty days included", () => {
    // Period 10-04 (Sun) .. 10-24 (Sat) = 3 weeks: 3 Tuesdays (10-06, 10-13, 10-20); only two have entries.
    const rows = [row("2026-10-06T13:00:00Z", 2 * H), row("2026-10-20T13:00:00Z", 4 * H)];
    const chart = buildWeekdayChart(rows, { fromDate: "2026-10-04", toDate: "2026-10-24" }, TZ, "2026-11-01");
    expect(chart.hasAverage).toBe(true);
    expect(chart.bars[2]).toMatchObject({ totalSeconds: 6 * H, days: 3, averageSeconds: 2 * H });
  });

  it("does not count days that have not happened yet", () => {
    // The whole of October, but today is Wed 2026-10-14: Wednesdays so far are 10-07 and 10-14 only.
    const rows = [row("2026-10-07T13:00:00Z", 3 * H), row("2026-10-14T13:00:00Z", H)];
    const chart = buildWeekdayChart(rows, { fromDate: "2026-10-01", toDate: "2026-10-31" }, TZ, "2026-10-14");
    expect(chart.bars[3]).toMatchObject({ days: 2, totalSeconds: 4 * H, averageSeconds: 2 * H });
    // Thursdays so far: 10-01, 10-08 (the 15th is still ahead).
    expect(chart.bars[4].days).toBe(2);
  });

  it("assigns an entry to its local day, not the UTC day", () => {
    // 2026-10-07T02:00Z is still Tuesday 10-06 in Recife (UTC-3).
    const chart = buildWeekdayChart([row("2026-10-07T02:00:00Z", H)], { fromDate: "2026-10-04", toDate: "2026-10-10" }, TZ, "2026-10-20");
    expect(chart.bars[2].totalSeconds).toBe(H);
    expect(chart.bars[3].totalSeconds).toBe(0);
  });

  it("a period still entirely ahead has no averages to divide by (no NaN)", () => {
    const chart = buildWeekdayChart([], { fromDate: "2026-11-01", toDate: "2026-11-30" }, TZ, "2026-10-14");
    expect(chart.hasAverage).toBe(false);
    expect(chart.bars.every((b) => b.days === 0 && b.averageSeconds === 0)).toBe(true);
  });

  it("rounds the average to the second", () => {
    // 2 Sundays (10-04, 10-11) and 3 s in total: 3 / 2 = 1.5 -> 2.
    const chart = buildWeekdayChart([row("2026-10-04T13:00:00Z", 3)], { fromDate: "2026-10-04", toDate: "2026-10-17" }, TZ, "2026-12-01");
    expect(chart.bars[0]).toMatchObject({ days: 2, averageSeconds: 2 });
  });
});
