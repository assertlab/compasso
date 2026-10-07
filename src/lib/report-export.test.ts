import { describe, expect, it } from "vitest";
import { buildCsv, csvCell, describeFilters, exportFileName, formatDateBr, formatTimeSpan, toExportRows, type ExportRow } from "./report-export";
import type { ReportRow } from "./report";

const row = (over: Partial<ExportRow> = {}): ExportRow => ({
  date: "2026-02-02",
  start: "09:00",
  endDate: "2026-02-02",
  end: "10:30",
  seconds: 5400,
  person: "Ana",
  client: "3 Corações",
  project: "Arquitetura",
  task: "Revisão",
  description: "Reunião",
  ...over,
});

describe("csvCell", () => {
  it("quotes separators, quotes and line breaks", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvCell("linha1\nlinha2")).toBe('"linha1\nlinha2"');
    expect(csvCell("simples")).toBe("simples");
  });

  it("neutralizes spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("a=b")).toBe("a=b");
  });
});

describe("buildCsv", () => {
  it("writes BOM, ';' separator, CRLF, decimal comma and exact duration", () => {
    const csv = buildCsv([row()], { includePerson: false });
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Data de início;Hora de início;Data de término;Hora de término;Duração;Horas;Cliente;Projeto;Tarefa;Descrição");
    expect(lines[1]).toBe("02/02/2026;09:00;02/02/2026;10:30;01:30:00;1,50;3 Corações;Arquitetura;Revisão;Reunião");
    expect(lines[2]).toBe("");
  });

  it("adds the person column only when asked", () => {
    const csv = buildCsv([row()], { includePerson: true }).slice(1).split("\r\n");
    expect(csv[0]).toContain("Horas;Pessoa;Cliente");
    expect(csv[1]).toContain("1,50;Ana;3 Corações");
  });

  it("keeps a header-only file for no rows", () => {
    expect(buildCsv([], { includePerson: false }).slice(1).split("\r\n")).toHaveLength(2);
  });
});

describe("toExportRows", () => {
  it("uses the local day and time of the zone", () => {
    const r: ReportRow = {
      id: "1",
      userId: "u",
      userName: "Ana",
      clientId: null,
      clientName: null,
      projectId: null,
      projectName: null,
      taskId: null,
      taskName: null,
      description: "",
      startedAt: new Date("2026-02-03T02:30:00Z"), // 23:30 on Feb 2 in Recife
      endedAt: new Date("2026-02-03T03:30:00Z"),
      seconds: 3600,
    };
    expect(toExportRows([r], "America/Recife")[0]).toMatchObject({ date: "2026-02-02", start: "23:30", endDate: "2026-02-03", end: "00:30", project: "Sem projeto", client: "", task: "" });
  });
});

describe("helpers", () => {
  it("formats dates and file names", () => {
    expect(formatDateBr("2026-02-03")).toBe("03/02/2026");
    expect(exportFileName("2026-02-01", "2026-02-28", "xlsx")).toBe("compasso-horas_2026-02-01_2026-02-28.xlsx");
  });

  it("marks entries that end on a later day", () => {
    expect(formatTimeSpan(row())).toBe("09:00–10:30");
    expect(formatTimeSpan(row({ start: "20:00", end: "01:30", endDate: "2026-02-03" }))).toBe("20:00–01:30 (+1)");
  });

  it("writes the end date of a night entry in the CSV", () => {
    const csv = buildCsv([row({ start: "20:00", end: "01:30", endDate: "2026-02-03", seconds: 19800 })], { includePerson: false }).slice(1).split("\r\n");
    expect(csv[1]).toBe("02/02/2026;20:00;03/02/2026;01:30;05:30:00;5,50;3 Corações;Arquitetura;Revisão;Reunião");
  });

  it("describes only the filters that are set", () => {
    const catalog = { organizations: [{ id: "c", name: "BNB" }], projects: [{ id: "p", name: "Portal" }], tasks: [{ id: "t", name: "Setup" }] };
    expect(describeFilters({ periodo: "mes", pessoas: [] }, catalog, null)).toEqual([]);
    expect(describeFilters({ periodo: "mes", cliente: "c", projeto: "p", tarefa: "t", pessoas: ["u"] }, catalog, [{ id: "u", name: "Ana" }])).toEqual([
      "Cliente: BNB",
      "Projeto: Portal",
      "Tarefa: Setup",
      "Pessoas: Ana",
    ]);
    expect(describeFilters({ periodo: "mes", projeto: "none", pessoas: [] }, catalog, null)).toEqual(["Projeto: Sem projeto"]);
  });
});
