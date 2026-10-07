import { describe, expect, it } from "vitest";
import {
  entryDurationSeconds,
  formatHms,
  localDateString,
  toDecimalHours,
  zonedDayRange,
  zonedMidnightUtc,
} from "./time";

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

describe("zoned day boundaries", () => {
  const hours = (r: { from: Date; to: Date }) => (r.to.getTime() - r.from.getTime()) / 3_600_000;

  it("America/Recife (UTC-3, no DST): the day starts at 03:00Z and lasts 24 h", () => {
    const r = zonedDayRange("2026-02-27", "America/Recife");
    expect(r.from.toISOString()).toBe("2026-02-27T03:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-02-28T03:00:00.000Z");
    expect(hours(r)).toBe(24);
  });

  it("handles the spring-forward day (23 h) and the fall-back day (25 h)", () => {
    expect(hours(zonedDayRange("2026-03-08", "America/New_York"))).toBe(23);
    expect(hours(zonedDayRange("2026-11-01", "America/New_York"))).toBe(25);
  });

  it("starts the day with the offset in force at midnight, not at the guess", () => {
    expect(zonedMidnightUtc("2026-03-08", "America/New_York").toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(zonedMidnightUtc("2026-03-09", "America/New_York").toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });

  it("handles month and year rollover", () => {
    expect(zonedDayRange("2026-12-31", "UTC").to.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("rejects malformed dates", () => {
    expect(() => zonedDayRange("27/02/2026", "UTC")).toThrow(RangeError);
  });
});

describe("localDateString", () => {
  it("returns the calendar date in the given zone", () => {
    const instant = at("2026-02-28T01:30:00Z"); // 22:30 on the 27th in Recife
    expect(localDateString(instant, "America/Recife")).toBe("2026-02-27");
    expect(localDateString(instant, "UTC")).toBe("2026-02-28");
  });
});
