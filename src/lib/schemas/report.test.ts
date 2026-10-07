import { describe, expect, it } from "vitest";
import { parseReportQuery } from "./report";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

describe("parseReportQuery", () => {
  it("defaults to the current month with no filters", () => {
    expect(parseReportQuery({})).toEqual({ periodo: "mes", pessoas: [] });
  });

  it("treats empty form values as 'all'", () => {
    expect(parseReportQuery({ periodo: "mes", cliente: "", projeto: "", tarefa: "", de: "", ate: "" })).toEqual({ periodo: "mes", pessoas: [] });
  });

  it("accepts the 'none' project and valid ids", () => {
    expect(parseReportQuery({ projeto: "none" }).projeto).toBe("none");
    expect(parseReportQuery({ cliente: U1 }).cliente).toBe(U1);
  });

  it("drops invalid values instead of failing", () => {
    const q = parseReportQuery({ periodo: "ontem", cliente: "x", de: "01/02/2026", pessoas: "lixo,also" });
    expect(q).toEqual({ periodo: "mes", pessoas: [] });
  });

  it("reads people repeated or comma-separated, without duplicates", () => {
    expect(parseReportQuery({ pessoas: [U1, U2, U1] }).pessoas).toEqual([U1, U2]);
    expect(parseReportQuery({ pessoas: `${U1},${U2}` }).pessoas).toEqual([U1, U2]);
  });
});
