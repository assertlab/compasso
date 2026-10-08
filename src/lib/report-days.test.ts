import { describe, expect, it } from "vitest";
import { buildDayMatrix, dayColumns, MAX_DAY_COLUMNS } from "./report-days";
import type { ReportRow } from "./report";

const TZ = "America/Recife"; // UTC-3, no DST
let n = 0;
const row = (startedAt: string, seconds: number, over: Partial<ReportRow> = {}): ReportRow => ({
  id: `e${n++}`,
  userId: "u1",
  userName: "Ana",
  clientId: "c1",
  clientName: "Cliente A",
  projectId: "p1",
  projectName: "Projeto 1",
  taskId: null,
  taskName: null,
  description: "",
  startedAt: new Date(startedAt),
  endedAt: new Date(new Date(startedAt).getTime() + seconds * 1000),
  seconds,
  corrected: false,
  ...over,
});

describe("dayColumns", () => {
  it("has one column per day up to the limit, labelled with the weekday", () => {
    const { granularity, columns } = dayColumns("2026-09-21", "2026-09-27");
    expect(granularity).toBe("dia");
    expect(columns.map((c) => c.key)).toEqual(["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]);
    expect(columns.map((c) => c.sublabel)).toEqual(["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]);
    expect(columns[0].label).toBe("21/09");
  });

  it("keeps days at exactly the limit and switches to weeks above it", () => {
    expect(dayColumns("2026-08-01", "2026-08-31").granularity).toBe("dia"); // 31 days
    expect(dayColumns("2026-08-01", "2026-08-31").columns).toHaveLength(MAX_DAY_COLUMNS);
    const long = dayColumns("2026-08-01", "2026-09-01"); // 32 days
    expect(long.granularity).toBe("semana");
    // 2026-08-01 is a Saturday: the first week starts on Monday 2026-07-27.
    expect(long.columns[0].key).toBe("2026-07-27");
    expect(long.columns.at(-1)?.key).toBe("2026-08-31");
  });
});

describe("buildDayMatrix", () => {
  const period = { fromDate: "2026-09-21", toDate: "2026-09-27" };

  it("sums hours per project and day, and the totals add up", () => {
    const m = buildDayMatrix(
      [
        row("2026-09-22T12:00:00Z", 3600),
        row("2026-09-22T15:00:00Z", 1800),
        row("2026-09-24T12:00:00Z", 600),
        row("2026-09-24T12:00:00Z", 60, { projectId: "p2", projectName: "Projeto 2" }),
      ],
      period,
      TZ,
      { includePeople: false },
    );
    expect(m.rows.map((r) => [r.label, r.total])).toEqual([
      ["Projeto 1", 6000],
      ["Projeto 2", 60],
    ]);
    expect(m.rows[0].cells).toEqual([0, 5400, 0, 600, 0, 0, 0]);
    expect(m.totals).toEqual([0, 5400, 0, 660, 0, 0, 0]);
    expect(m.grandTotal).toBe(6060);
    expect(m.rows.reduce((a, r) => a + r.total, 0)).toBe(m.grandTotal);
  });

  it("assigns the entry to the local day it started, not the UTC day", () => {
    // 2026-09-23 01:30 UTC is still 22/09 22:30 in Recife.
    const m = buildDayMatrix([row("2026-09-23T01:30:00Z", 600)], period, TZ, { includePeople: false });
    expect(m.rows[0].cells).toEqual([0, 600, 0, 0, 0, 0, 0]);
  });

  it("puts 'Sem projeto' last and orders by client then project", () => {
    const m = buildDayMatrix(
      [
        row("2026-09-22T12:00:00Z", 10, { projectId: null, projectName: null, clientId: null, clientName: null }),
        row("2026-09-22T12:00:00Z", 10, { clientName: "Zeta", projectId: "p3", projectName: "A" }),
        row("2026-09-22T12:00:00Z", 10, { clientName: "Alfa", projectId: "p4", projectName: "Z" }),
      ],
      period,
      TZ,
      { includePeople: false },
    );
    expect(m.rows.map((r) => r.label)).toEqual(["Z", "A", "Sem projeto"]);
    expect(m.rows[2].sublabel).toBeNull();
  });

  it("adds person rows under a project only when asked and more than one person worked on it", () => {
    const rows = [row("2026-09-22T12:00:00Z", 60), row("2026-09-22T12:00:00Z", 30, { userId: "u2", userName: "Bia" })];
    const withPeople = buildDayMatrix(rows, period, TZ, { includePeople: true });
    expect(withPeople.rows.map((r) => [r.level, r.label, r.total])).toEqual([[0, "Projeto 1", 90], [1, "Ana", 60], [1, "Bia", 30]]);
    expect(withPeople.totals.reduce((a, b) => a + b, 0)).toBe(90); // person rows are not double counted
    expect(buildDayMatrix(rows, period, TZ, { includePeople: false }).rows).toHaveLength(1);
    expect(buildDayMatrix(rows.slice(0, 1), period, TZ, { includePeople: true }).rows).toHaveLength(1);
  });

  it("uses week columns for long periods and puts each entry in its Monday-based week", () => {
    const m = buildDayMatrix([row("2026-08-05T12:00:00Z", 100), row("2026-08-31T12:00:00Z", 50)], { fromDate: "2026-08-01", toDate: "2026-09-15" }, TZ, {
      includePeople: false,
    });
    expect(m.granularity).toBe("semana");
    const i = (key: string) => m.columns.findIndex((c) => c.key === key);
    expect(m.rows[0].cells[i("2026-08-03")]).toBe(100);
    expect(m.rows[0].cells[i("2026-08-31")]).toBe(50);
    expect(m.grandTotal).toBe(150);
  });

  it("returns no rows for no entries", () => {
    const m = buildDayMatrix([], period, TZ, { includePeople: false });
    expect(m.rows).toEqual([]);
    expect(m.grandTotal).toBe(0);
    expect(m.columns).toHaveLength(7);
  });
});

describe("formatHm", () => {
  it("rounds to the nearest minute and keeps hours above 24", async () => {
    const { formatHm } = await import("./report-days");
    expect(formatHm(0)).toBe("0:00");
    expect(formatHm(29)).toBe("0:00");
    expect(formatHm(30)).toBe("0:01");
    expect(formatHm(26115)).toBe("7:15"); // 07:15:15
    expect(formatHm(90_000)).toBe("25:00");
  });
});
