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
  corrected: false,
  ...over,
});

describe("summarize", () => {
  it("returns zeros for no rows", () => {
    expect(summarize([])).toEqual({ groupBy: "descricao", totalSeconds: 0, totalEntries: 0, clients: [], people: [] });
  });

  it("sums by client > project > task and the parts always add up to the total", () => {
    const s = summarize([
      row({ seconds: 3600 }),
      row({ seconds: 1800 }),
      row({ taskId: "t2", taskName: "Daily", seconds: 900 }),
      row({ projectId: "p2", projectName: "API", taskId: null, taskName: null, seconds: 600 }),
      row({ clientId: "c2", clientName: "BNB", projectId: "p3", projectName: "Portal", taskId: "t3", taskName: "Setup", seconds: 7200 }),
    ], "tarefa");
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
    expect(tc.projects[0].items).toEqual([{ id: null, name: "Sem tarefa", seconds: 600, entries: 1 }]);
    expect(tc.projects[1].items.map((t) => [t.name, t.seconds, t.entries])).toEqual([
      ["Daily", 900, 1],
      ["Revisão", 5400, 2],
    ]);
    expect(s.clients.reduce((a, c) => a + c.seconds, 0)).toBe(s.totalSeconds);
  });

  describe("grouping by description (the default)", () => {
    it("merges descriptions that differ only in case or spacing, keeping the first spelling", () => {
      const s = summarize([
        row({ description: "Reunião  3Corações", seconds: 600 }),
        row({ description: "reunião 3corações ", seconds: 300 }),
        row({ description: "Documento", seconds: 100 }),
      ]);
      expect(s.groupBy).toBe("descricao");
      expect(s.clients[0].projects[0].items.map((i) => [i.name, i.seconds, i.entries])).toEqual([
        ["Documento", 100, 1],
        ["Reunião 3Corações", 900, 2],
      ]);
    });

    it("puts empty descriptions in a last 'Sem descrição' bucket and ignores tasks", () => {
      const s = summarize([
        row({ description: "", taskId: "t1", seconds: 60 }),
        row({ description: "   ", taskId: "t2", taskName: "Outra", seconds: 40 }),
        row({ description: "Aaa", seconds: 5 }),
      ]);
      const items = s.clients[0].projects[0].items;
      expect(items.map((i) => [i.name, i.seconds])).toEqual([
        ["Aaa", 5],
        ["Sem descrição", 100],
      ]);
      expect(items[1].id).toBeNull();
    });

    it("keeps the same totals as grouping by task", () => {
      const rows = [row({ description: "a", seconds: 10 }), row({ description: "b", taskId: null, taskName: null, seconds: 20 })];
      const byDescription = summarize(rows, "descricao");
      const byTask = summarize(rows, "tarefa");
      expect(byDescription.totalSeconds).toBe(byTask.totalSeconds);
      expect(byDescription.clients[0].seconds).toBe(byTask.clients[0].seconds);
    });
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
