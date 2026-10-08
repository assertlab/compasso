import { describe, expect, it } from "vitest";
import { buildHighlights } from "./dashboard";
import { summarize, type ReportRow } from "./report";

const TZ = "America/Recife";
let n = 0;
const row = (day: string, seconds: number, over: Partial<ReportRow> = {}): ReportRow => {
  n += 1;
  const startedAt = new Date(`${day}T13:00:00Z`);
  return {
    id: `r${n}`, userId: "u1", userName: "Ana", clientId: "c1", clientName: "Cliente A", projectId: "p1", projectName: "Projeto X",
    taskId: null, taskName: null, description: "Reunião", startedAt, endedAt: new Date(startedAt.getTime() + seconds * 1000), seconds, corrected: false, ...over,
  };
};
const highlights = (rows: ReportRow[]) => buildHighlights(rows, summarize(rows), TZ);

describe("buildHighlights", () => {
  const rows = [
    row("2026-09-01", 3600),
    row("2026-09-01", 1800, { projectId: "p2", projectName: "Projeto Y" }),
    row("2026-09-03", 9000, { clientId: "c2", clientName: "Cliente B", projectId: "p3", projectName: "Projeto Z" }),
  ];

  it("finds the main project and client with their share of the total", () => {
    const h = highlights(rows);
    expect(h.totalSeconds).toBe(14400);
    expect(h.topProject).toMatchObject({ label: "Projeto Z", sublabel: "Cliente B", seconds: 9000, percent: 62.5 });
    expect(h.topClient).toMatchObject({ label: "Cliente B", seconds: 9000 });
  });

  it("finds the busiest day and averages over active days only", () => {
    const h = highlights(rows);
    expect(h.busiestDay).toEqual({ date: "2026-09-03", seconds: 9000 });
    expect(h.activeDays).toBe(2);
    expect(h.averageSecondsPerActiveDay).toBe(7200);
  });

  it("attributes an entry to the local day it starts, not the UTC day", () => {
    // 01:30 UTC on the 2nd is still the 1st in Recife (UTC-3).
    const late = row("2026-09-02", 600, { startedAt: new Date("2026-09-02T01:30:00Z"), endedAt: new Date("2026-09-02T01:40:00Z") });
    expect(highlights([late]).busiestDay?.date).toBe("2026-09-01");
  });

  it("never highlights entries without a project", () => {
    const h = highlights([row("2026-09-01", 600, { projectId: null, projectName: null, clientId: null, clientName: null })]);
    expect(h.topProject).toBeNull();
    expect(h.topClient).toBeNull();
    expect(h.totalSeconds).toBe(600);
  });

  it("breaks ties by the earlier day and is empty-safe", () => {
    const tie = highlights([row("2026-09-05", 600), row("2026-09-04", 600)]);
    expect(tie.busiestDay?.date).toBe("2026-09-04");
    const empty = highlights([]);
    expect(empty).toMatchObject({ totalSeconds: 0, activeDays: 0, averageSecondsPerActiveDay: 0, busiestDay: null, topProject: null });
  });
});
