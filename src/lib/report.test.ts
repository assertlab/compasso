import { describe, expect, it } from "vitest";
import { summarize, type ReportRow } from "./report";

let n = 0;
const row = (over: Partial<ReportRow>): ReportRow => ({
  id: `e${n++}`,
  userId: "u1",
  userName: "Ana",
  clientId: "c1",
  clientName: "3 Corações",
  projectId: "p1",
  projectName: "Arquitetura",
  taskId: "t1",
  taskName: "Revisão",
  description: "",
  startedAt: new Date("2026-02-02T12:00:00Z"),
  endedAt: new Date("2026-02-02T13:00:00Z"),
  seconds: 3600,
  ...over,
});

describe("summarize", () => {
  it("returns zeros for no rows", () => {
    expect(summarize([])).toEqual({ totalSeconds: 0, totalEntries: 0, clients: [], people: [] });
  });

  it("sums by client > project > task and the parts always add up to the total", () => {
    const s = summarize([
      row({ seconds: 3600 }),
      row({ seconds: 1800 }),
      row({ taskId: "t2", taskName: "Daily", seconds: 900 }),
      row({ projectId: "p2", projectName: "API", taskId: null, taskName: null, seconds: 600 }),
      row({ clientId: "c2", clientName: "BNB", projectId: "p3", projectName: "Portal", taskId: "t3", taskName: "Setup", seconds: 7200 }),
    ]);
    expect(s.totalSeconds).toBe(3600 + 1800 + 900 + 600 + 7200);
    expect(s.totalEntries).toBe(5);
    expect(s.clients.map((c) => [c.name, c.seconds])).toEqual([
      ["3 Corações", 6900],
      ["BNB", 7200],
    ]);
    const tc = s.clients[0];
    expect(tc.projects.map((p) => [p.name, p.seconds])).toEqual([
      ["API", 600],
      ["Arquitetura", 6300],
    ]);
    expect(tc.projects[0].tasks).toEqual([{ id: null, name: "Sem tarefa", seconds: 600, entries: 1 }]);
    expect(tc.projects[1].tasks.map((t) => [t.name, t.seconds, t.entries])).toEqual([
      ["Daily", 900, 1],
      ["Revisão", 5400, 2],
    ]);
    expect(s.clients.reduce((a, c) => a + c.seconds, 0)).toBe(s.totalSeconds);
  });

  it("keeps entries without a project in a final 'Sem projeto' bucket", () => {
    const s = summarize([
      row({ clientId: null, clientName: null, projectId: null, projectName: null, taskId: null, taskName: null, seconds: 17 }),
      row({ clientId: "c0", clientName: "Zeta", seconds: 60 }),
    ]);
    expect(s.clients.map((c) => c.name)).toEqual(["Zeta", "Sem projeto"]);
    expect(s.clients[1].projects[0]).toMatchObject({ id: null, name: "Sem projeto", seconds: 17 });
    expect(s.totalSeconds).toBe(77);
  });

  it("totals per person", () => {
    const s = summarize([row({ seconds: 60 }), row({ userId: "u2", userName: "Bia", seconds: 120 }), row({ seconds: 30 })]);
    expect(s.people).toEqual([
      { id: "u1", name: "Ana", seconds: 90, entries: 2 },
      { id: "u2", name: "Bia", seconds: 120, entries: 1 },
    ]);
  });
});
