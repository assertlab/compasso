import { describe, expect, it } from "vitest";
import { roleFromBetterAuth } from "./context";

describe("roleFromBetterAuth", () => {
  it("treats owner and admin as workspace admin", () => {
    expect(roleFromBetterAuth("owner")).toBe("admin");
    expect(roleFromBetterAuth("admin")).toBe("admin");
    expect(roleFromBetterAuth("member,admin")).toBe("admin");
  });
  it("treats member, unknown and empty roles as member", () => {
    expect(roleFromBetterAuth("member")).toBe("member");
    expect(roleFromBetterAuth("viewer")).toBe("member");
    expect(roleFromBetterAuth(null)).toBe("member");
    expect(roleFromBetterAuth(undefined)).toBe("member");
  });
});
