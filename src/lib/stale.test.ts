import { describe, expect, it } from "vitest";
import { isStale } from "./stale";

describe("isStale", () => {
  const now = new Date("2026-10-06T12:00:00Z");
  it("is fresh inside the ttl", () => {
    expect(isStale(new Date("2026-10-06T11:55:00Z"), now, 10 * 60_000)).toBe(false);
  });
  it("is stale at or beyond the ttl", () => {
    expect(isStale(new Date("2026-10-06T11:50:00Z"), now, 10 * 60_000)).toBe(true);
    expect(isStale(new Date("2026-10-06T10:00:00Z"), now, 10 * 60_000)).toBe(true);
  });
});
