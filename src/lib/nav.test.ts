import { describe, expect, it } from "vitest";
import { isNavActive, navGroupsFor, type NavItem } from "./nav";

const item = (id: NavItem["id"]) => navGroupsFor(true).flatMap((g) => g.items).find((i) => i.id === id)!;

describe("navGroupsFor", () => {
  const ids = (admin: boolean) => navGroupsFor(admin).flatMap((g) => g.items.map((i) => i.id));

  it("hides Membros from members and keeps everything else", () => {
    expect(ids(false)).not.toContain("membros");
    expect(ids(true)).toContain("membros");
    expect(ids(true).filter((id) => id !== "membros")).toEqual(ids(false));
  });

  it("groups the menu as registros, analisar and gerenciar", () => {
    expect(navGroupsFor(false).map((g) => g.label)).toEqual([null, "Analisar", "Gerenciar"]);
  });
});

describe("isNavActive", () => {
  it("matches the home page only exactly", () => {
    expect(isNavActive(item("registros"), "/", null)).toBe(true);
    expect(isNavActive(item("registros"), "/painel", null)).toBe(false);
  });

  it("matches sections by prefix without confusing similar names", () => {
    expect(isNavActive(item("relatorios"), "/relatorios", null)).toBe(true);
    expect(isNavActive(item("relatorios"), "/relatorios/export", null)).toBe(true);
    expect(isNavActive(item("painel"), "/relatorios", null)).toBe(false);
  });

  it("marks one cadastros tab at a time, defaulting to the first", () => {
    expect(isNavActive(item("clientes"), "/cadastros", null)).toBe(true);
    expect(isNavActive(item("projetos"), "/cadastros", null)).toBe(false);
    expect(isNavActive(item("projetos"), "/cadastros", "projetos")).toBe(true);
    expect(isNavActive(item("tags"), "/cadastros", "projetos")).toBe(false);
  });

  it("counts a project's own page as Projetos", () => {
    expect(isNavActive(item("projetos"), "/cadastros/projetos/abc", null)).toBe(true);
    expect(isNavActive(item("clientes"), "/cadastros/projetos/abc", null)).toBe(false);
  });

  it("never marks cadastros items on other pages", () => {
    expect(isNavActive(item("clientes"), "/painel", null)).toBe(false);
  });
});
