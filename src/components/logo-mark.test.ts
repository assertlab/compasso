import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LogoMark } from "./logo-mark";

// Reduz um SVG a uma lista de elementos comparável (ignora espaços e a tag <svg>).
function elements(svg: string): string[] {
  return (svg.match(/<(?:circle|line|polygon)\b[^>]*>/g) ?? []).map((e) =>
    e.replace(/\/?>$/, "").replace(/\s+/g, " ").trim(),
  );
}

describe("LogoMark", () => {
  const file = readFileSync(path.join(process.cwd(), "brand/relogio/compasso-marca.svg"), "utf8");
  const html = renderToStaticMarkup(createElement(LogoMark));

  it("é igual ao SVG gerado em brand/relogio (rode gerar-logo.py se falhar)", () => {
    expect(elements(html)).toEqual(elements(file));
    expect(html).toContain(file.match(/viewBox="[^"]+"/)![0]);
  });

  it("é decorativa: aria-hidden e sem fundo", () => {
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/<rect/);
  });

  it("a marca do PDF (react-pdf) tem os mesmos elementos do SVG", () => {
    const src = readFileSync(path.join(process.cwd(), "src/server/logo-mark-pdf.tsx"), "utf8");
    const norm = (e: string) =>
      e
        .replace(/^<(\w)/, (_, c: string) => `<${c.toLowerCase()}`)
        .replace(/ c[xy]="0"/g, "")
        .replace(/strokeWidth/g, "stroke-width")
        .replace(/strokeLinecap/g, "stroke-linecap");
    const pdf = (src.match(/<(?:Circle|Line|Polygon)\b[^>]*>/g) ?? []).map((e) => norm(e.replace(/\/?>$/, "").replace(/\s+/g, " ").trim()));
    expect(pdf).toEqual(elements(file));
    expect(src).toContain(file.match(/viewBox="[^"]+"/)![0]);
  });
});
