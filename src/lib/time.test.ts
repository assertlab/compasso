import { describe, expect, it } from "vitest";
import { entryDurationSeconds, formatHms, toDecimalHours } from "./time";

const at = (iso: string) => new Date(iso);

describe("entryDurationSeconds", () => {
  it("derives duration from start and end", () => {
    expect(
      entryDurationSeconds(at("2026-02-27T15:00:00Z"), at("2026-02-27T18:00:00Z")),
    ).toBe(10800);
  });

  it("uses `now` for a running entry", () => {
    expect(
      entryDurationSeconds(at("2026-02-27T09:00:00Z"), null, at("2026-02-27T09:00:42Z")),
    ).toBe(42);
  });

  it("rejects an end before the start", () => {
    expect(() =>
      entryDurationSeconds(at("2026-02-27T10:00:00Z"), at("2026-02-27T09:00:00Z")),
    ).toThrow(RangeError);
  });
});

describe("toDecimalHours (cases taken from the real Clockify export)", () => {
  it.each([
    [3 * 3600 + 5 * 60, 3.08], // 03:05 was mis-read as a date by the Clockify export
    [3600 + 6 * 60 + 7, 1.1], // 01:06:07
    [4 * 3600 + 25 * 60, 4.42],
    [2.5 * 3600, 2.5],
    [40 * 60, 0.67],
  ])("%d s -> %d h", (seconds, hours) => {
    expect(toDecimalHours(seconds)).toBe(hours);
  });
});

describe("formatHms", () => {
  it("pads and allows more than 24 hours", () => {
    expect(formatHms(0)).toBe("00:00:00");
    expect(formatHms(3661)).toBe("01:01:01");
    expect(formatHms(100 * 3600)).toBe("100:00:00");
  });
});
