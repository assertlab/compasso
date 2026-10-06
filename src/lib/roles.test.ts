import { describe, expect, it } from "vitest";
import { roleFromClerk } from "./roles";

describe("roleFromClerk", () => {
  it("maps org:admin to admin", () => {
    expect(roleFromClerk("org:admin")).toBe("admin");
  });
  it("maps org:member and unknown roles to member", () => {
    expect(roleFromClerk("org:member")).toBe("member");
    expect(roleFromClerk("org:custom")).toBe("member");
    expect(roleFromClerk(undefined)).toBe("member");
    expect(roleFromClerk(null)).toBe("member");
  });
});
