import { describe, expect, it } from "vitest";
import { axisTicks, buildCharts, formatAxisHours, formatPercent, MAX_ACTIVITY_ITEMS, OTHERS_ID, rankShares } from "./report-charts";
import { summarize, type ReportRow } from "./report";
import { buildDayMatrix } from "./report-days";

const TZ = "America/Recife";
const period = { fromDate: "2026-09-01", toDate: "2026-09-03" };

let n = 0;
function row(over: Partial<ReportRow> & { day: string; seconds: number }): ReportRow {
  n += 1;
  const { day, seconds, ...rest } = over;
  const startedAt = new Date(`${day}T13:00:00Z`);
  return {
    id: `r${n}`,
    userId: "u1",
    userName: "Ana",
    clientId: "c1",
    clientName: "Cliente A",
    projectId: "p1",
    projectName: "Projeto X",
    taskId: null,
    taskName: null,
    description: "Reunião",
    startedAt,
    endedAt: new Date(startedAt.getTime() + seconds * 1000),
    seconds,
    corrected: false,
    ...rest,
  };
}

const charts = (rows: ReportRow[], groupBy: "descricao" | "tarefa" = "descricao") =>
  buildCharts(summarize(rows, groupBy), buildDayMatrix(rows, period, TZ, { includePeople: false }));

describe("formatPercent", () => {
  it("never shows a tiny share as empty", () => {
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(0.4)).toBe("<1%");
    expect(formatPercent(33.4)).toBe("33%");
    expect(formatPercent(100)).toBe("100%");
  });
});

describe("rankShares", () => {
  const item = (id: string, seconds: number) => ({ id, label: id, sublabel: null, seconds });

  it("sorts largest first and drops empty items", () => {
    const out = rankShares([item("a", 10), item("b", 30), item("z", 0)], 40, 5);
    expect(out.map((i) => i.id)).toEqual(["b", "a"]);
    expect(out[0].percent).toBe(75);
  });

  it("folds the tail into one Outros row that keeps the total", () => {
    const items = Array.from({ length: 6 }, (_, i) => item(`i${i}`, 60 - i * 10));
    const out = rankShares(items, 210, 3);
    expect(out).toHaveLength(4);
    expect(out[3]).toMatchObject({ id: OTHERS_ID, label: "Outros (3)", seconds: 60 });
    expect(out.reduce((s, i) => s + i.seconds, 0)).toBe(items.reduce((s, i) => s + i.seconds, 0));
  });

  it("does not fold a single leftover item into Outros", () => {
    expect(rankShares([item("a", 3), item("b", 2), item("c", 1)], 6, 2).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("is safe with a zero total", () => {
    expect(rankShares([item("a", 0)], 0, 3)).toEqual([]);
  });
});

describe("buildCharts", () => {
  const rows = [
    row({ day: "2026-09-01", seconds: 3600 }),
    row({ day: "2026-09-01", seconds: 1800, projectId: "p2", projectName: "Projeto Y", description: "Revisão" }),
    row({ day: "2026-09-03", seconds: 5400, userId: "u2", userName: "Bruno", description: "  reunião " }),
  ];

  it("has one bar per day, matching the day matrix totals", () => {
    const c = charts(rows);
    expect(c.granularity).toBe("dia");
    expect(c.bars.map((b) => b.seconds)).toEqual([5400, 0, 5400]);
    expect(c.barMax).toBe(5400);
  });

  it("shares by project carry the client and add up to 100%", () => {
    const c = charts(rows);
    expect(c.projects.map((p) => [p.label, p.sublabel, p.seconds])).toEqual([
      ["Projeto X", "Cliente A", 9000],
      ["Projeto Y", "Cliente A", 1800],
    ]);
    expect(c.projects.reduce((s, p) => s + p.percent, 0)).toBeCloseTo(100);
  });

  it("merges the same description across projects and people (case and spacing ignored)", () => {
    const c = charts(rows);
    expect(c.activities.find((a) => a.label === "Reunião")?.seconds).toBe(9000);
  });

  it("switches to tasks when grouped by task", () => {
    const c = charts([row({ day: "2026-09-01", seconds: 60, taskId: "t1", taskName: "Análise" }), row({ day: "2026-09-02", seconds: 60 })], "tarefa");
    expect(c.activities.map((a) => a.label).sort()).toEqual(["Análise", "Sem tarefa"]);
  });

  it("keeps entries without a project in a Sem projeto row", () => {
    const c = charts([row({ day: "2026-09-01", seconds: 60, projectId: null, projectName: null, clientId: null, clientName: null })]);
    expect(c.projects).toMatchObject([{ label: "Sem projeto", sublabel: null }]);
  });

  it("lists people and caps long activity lists", () => {
    const many = Array.from({ length: MAX_ACTIVITY_ITEMS + 3 }, (_, i) => row({ day: "2026-09-01", seconds: 60 + i, description: `Atividade ${i}` }));
    const c = charts([...rows, ...many]);
    expect(c.people.map((p) => p.label)).toEqual(["Ana", "Bruno"]);
    expect(c.activities).toHaveLength(MAX_ACTIVITY_ITEMS + 1);
    expect(c.activities.at(-1)?.id).toBe(OTHERS_ID);
  });

  it("is empty-safe", () => {
    const c = charts([]);
    expect(c.barMax).toBe(1);
    expect(c.projects).toEqual([]);
  });
});

describe("axisTicks", () => {
  const hours = (max: number) => axisTicks(max * 3600).map((t) => t / 3600);

  it("starts at zero and covers the tallest bar with round steps", () => {
    expect(hours(7.5)).toEqual([0, 2, 4, 6, 8]);
    expect(hours(3)).toEqual([0, 1, 2, 3]);
    expect(hours(40)).toEqual([0, 10, 20, 30, 40]);
  });

  it("handles tiny and empty periods", () => {
    expect(hours(0.1)).toEqual([0, 0.25]);
    expect(axisTicks(0)[0]).toBe(0);
  });

  it("never exceeds five ticks", () => {
    for (const h of [0.3, 1, 2.2, 9, 13, 26, 80, 333]) expect(axisTicks(h * 3600).length).toBeLessThanOrEqual(6);
  });
});

describe("formatAxisHours", () => {
  it("uses a decimal comma", () => {
    expect(formatAxisHours(7200)).toBe("2h");
    expect(formatAxisHours(5400)).toBe("1,5h");
    expect(formatAxisHours(900)).toBe("0,25h");
  });
});
