import { describe, expect, it } from "vitest";
import { resolvePeriod, type ResolvedPeriod } from "./report-period";

const TZ = "America/Recife"; // UTC-3, no DST
const ok = (r: ReturnType<typeof resolvePeriod>) => {
  if ("error" in r) throw new Error(r.error);
  return r as ResolvedPeriod;
};

describe("resolvePeriod", () => {
  const today = "2026-10-07"; // Wednesday

  it("current month runs from the 1st to today", () => {
    const p = ok(resolvePeriod("mes", today, TZ));
    expect([p.fromDate, p.toDate]).toEqual(["2026-10-01", "2026-10-07"]);
    expect(p.from.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-10-08T03:00:00.000Z"); // exclusive: start of the next day
  });

  it("previous month is the whole month, across a year boundary too", () => {
    expect([ok(resolvePeriod("mes-anterior", today, TZ)).fromDate, ok(resolvePeriod("mes-anterior", today, TZ)).toDate]).toEqual(["2026-09-01", "2026-09-30"]);
    const jan = ok(resolvePeriod("mes-anterior", "2026-01-15", TZ));
    expect([jan.fromDate, jan.toDate]).toEqual(["2025-12-01", "2025-12-31"]);
    const mar = ok(resolvePeriod("mes-anterior", "2026-03-02", TZ));
    expect(mar.toDate).toBe("2026-02-28");
  });

  it("weeks start on Monday", () => {
    const w = ok(resolvePeriod("semana", today, TZ));
    expect([w.fromDate, w.toDate]).toEqual(["2026-10-05", "2026-10-07"]);
    const prev = ok(resolvePeriod("semana-anterior", today, TZ));
    expect([prev.fromDate, prev.toDate]).toEqual(["2026-09-28", "2026-10-04"]);
  });

  it("60 and 90 days are rolling windows that include today", () => {
    const p = ok(resolvePeriod("60", today, TZ));
    expect(p.toDate).toBe("2026-10-07");
    expect(p.fromDate).toBe("2026-08-09"); // 60 days: Aug 9 .. Oct 7
    expect(ok(resolvePeriod("90", today, TZ)).fromDate).toBe("2026-07-10");
  });

  it("custom range is inclusive of both days and validated", () => {
    const p = ok(resolvePeriod("custom", today, TZ, { from: "2026-02-01", to: "2026-02-28" }));
    expect(p.to.toISOString()).toBe("2026-03-01T03:00:00.000Z");
    expect(resolvePeriod("custom", today, TZ, {})).toHaveProperty("error");
    expect(resolvePeriod("custom", today, TZ, { from: "2026-03-01", to: "2026-02-01" })).toHaveProperty("error");
    expect(resolvePeriod("custom", today, TZ, { from: "2024-01-01", to: "2026-01-01" })).toHaveProperty("error");
    expect(resolvePeriod("custom", today, TZ, { from: "2026-03-01", to: "2026-03-01" })).not.toHaveProperty("error");
  });
});
