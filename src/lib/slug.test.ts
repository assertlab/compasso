import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("removes accents and punctuation", () => {
    expect(slugify("Laboratório ASSERT — CIn/UFPE")).toBe("laboratorio-assert-cin-ufpe");
  });
  it("falls back when nothing usable remains", () => {
    expect(slugify("!!!")).toBe("workspace");
  });
  it("truncates without a trailing hyphen", () => {
    const slug = slugify("a".repeat(47) + " b", 48);
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith("-")).toBe(false);
  });
});
