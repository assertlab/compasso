import { describe, expect, it } from "vitest";
import { impliedEndDate } from "./entry-dates";

describe("impliedEndDate", () => {
  it("stays on the same day when the end is after the start", () => {
    expect(impliedEndDate("2026-02-02", "09:00", "10:30")).toBe("2026-02-02");
  });
  it("moves to the next day when the end is before or equal to the start", () => {
    expect(impliedEndDate("2026-02-02", "20:00", "01:30")).toBe("2026-02-03");
    expect(impliedEndDate("2026-02-02", "09:00", "09:00")).toBe("2026-02-03");
  });
  it("crosses month and year boundaries", () => {
    expect(impliedEndDate("2026-12-31", "23:00", "02:00")).toBe("2027-01-01");
    expect(impliedEndDate("2026-02-28", "22:00", "00:30")).toBe("2026-03-01");
  });
  it("keeps the same day while a time is still empty", () => {
    expect(impliedEndDate("2026-02-02", "", "01:00")).toBe("2026-02-02");
    expect(impliedEndDate("2026-02-02", "20:00", "")).toBe("2026-02-02");
  });
});
