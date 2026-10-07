import { describe, expect, it } from "vitest";
import { checkRange } from "./time-entry-rules";

const now = new Date("2026-02-27T12:00:00Z");
const at = (iso: string) => new Date(iso);

describe("checkRange", () => {
  it("accepts a normal range", () => {
    expect(checkRange(at("2026-02-27T09:00:00Z"), at("2026-02-27T11:00:00Z"), now)).toBeNull();
  });

  it("rejects end equal to or before start", () => {
    expect(checkRange(at("2026-02-27T09:00:00Z"), at("2026-02-27T09:00:00Z"), now)).toBe("end_not_after_start");
    expect(checkRange(at("2026-02-27T09:00:00Z"), at("2026-02-27T08:00:00Z"), now)).toBe("end_not_after_start");
  });

  it("allows exactly 24 h and rejects more", () => {
    expect(checkRange(at("2026-02-26T11:00:00Z"), at("2026-02-27T11:00:00Z"), now)).toBeNull();
    expect(checkRange(at("2026-02-26T10:59:59Z"), at("2026-02-27T11:00:00Z"), now)).toBe("too_long");
  });

  it("rejects the future beyond the 60 s tolerance", () => {
    expect(checkRange(at("2026-02-27T11:00:00Z"), at("2026-02-27T12:00:59Z"), now)).toBeNull();
    expect(checkRange(at("2026-02-27T11:00:00Z"), at("2026-02-27T12:01:01Z"), now)).toBe("in_future");
    expect(checkRange(at("2026-02-27T12:05:00Z"), null, now)).toBe("in_future");
  });

  it("accepts a running timer started in the past", () => {
    expect(checkRange(at("2026-02-27T09:00:00Z"), null, now)).toBeNull();
  });
});
