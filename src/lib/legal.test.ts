import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL, LEGAL_PATHS, LEGAL_VERSION, MIN_AGE, PROCESSORS, formatLegalVersion } from "./legal";

describe("formatLegalVersion", () => {
  it("writes the date in Portuguese, without a leading zero", () => {
    expect(formatLegalVersion("2026-10-14")).toBe("14 de outubro de 2026");
    expect(formatLegalVersion("2027-03-05")).toBe("5 de março de 2027");
  });
  it("rejects anything that is not a plain ISO date", () => {
    expect(() => formatLegalVersion("14/10/2026")).toThrow();
    expect(() => formatLegalVersion("2026-13-01")).toThrow();
  });
  it("accepts the version constant and it is not in the future", () => {
    expect(() => formatLegalVersion()).not.toThrow();
    expect(LEGAL_VERSION <= new Date().toISOString().slice(0, 10)).toBe(true);
  });
});

describe("legal constants", () => {
  it("keeps the public routes and contact the pages and links rely on", () => {
    expect(LEGAL_PATHS).toEqual({ terms: "/termos", privacy: "/privacidade" });
    expect(CONTACT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    expect(MIN_AGE).toBe(18);
  });
  it("lists every processor with purpose and location, and says where the database is", () => {
    for (const processor of PROCESSORS) {
      expect(processor.name.length).toBeGreaterThan(0);
      expect(processor.purpose.length).toBeGreaterThan(10);
      expect(processor.where.length).toBeGreaterThan(5);
    }
    const neon = PROCESSORS.find((p) => p.name === "Neon");
    expect(neon?.where).toContain("us-east-2");
    expect(new Set(PROCESSORS.map((p) => p.name)).size).toBe(PROCESSORS.length);
  });
});
