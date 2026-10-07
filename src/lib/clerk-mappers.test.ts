import { describe, expect, it } from "vitest";
import { anonymizedUser, fullName, userFromClerk, workspaceFromClerk } from "./clerk-mappers";

describe("fullName", () => {
  it("joins first and last, skipping blanks", () => {
    expect(fullName("Ana", "Silva")).toBe("Ana Silva");
    expect(fullName("Ana", null)).toBe("Ana");
    expect(fullName(null, undefined)).toBeNull();
    expect(fullName("", "")).toBeNull();
  });
});

describe("userFromClerk", () => {
  const base = { id: "user_1", first_name: "Ana", last_name: "Silva", image_url: "https://img/x.png" };

  it("prefers the primary email", () => {
    const data = userFromClerk({
      ...base,
      primary_email_address_id: "e2",
      email_addresses: [
        { id: "e1", email_address: "old@x.com" },
        { id: "e2", email_address: "main@x.com" },
      ],
    });
    expect(data).toEqual({ clerkId: "user_1", email: "main@x.com", name: "Ana Silva", avatarUrl: "https://img/x.png" });
  });

  it("falls back to the first email when the primary is unknown", () => {
    const data = userFromClerk({ ...base, email_addresses: [{ id: "e1", email_address: "a@x.com" }] });
    expect(data?.email).toBe("a@x.com");
  });

  it("returns null without any email", () => {
    expect(userFromClerk({ ...base, email_addresses: [] })).toBeNull();
    expect(userFromClerk(base)).toBeNull();
  });
});

describe("workspaceFromClerk", () => {
  it("builds a slug with a stable id suffix", () => {
    expect(workspaceFromClerk({ id: "org_2abCDEF123", name: "ASSERT Lab", slug: "assert-lab" })).toEqual({
      clerkOrgId: "org_2abCDEF123",
      name: "ASSERT Lab",
      slug: "assert-lab-def123",
    });
  });

  it("falls back to the name when there is no slug", () => {
    expect(workspaceFromClerk({ id: "org_zzzzzz", name: "Meu Estúdio" }).slug).toMatch(/^meu-estudio-zzzzzz$/);
  });
});

describe("anonymizedUser", () => {
  it("strips personal fields and keeps the unique email unique per row", () => {
    const a = anonymizedUser("11111111");
    const b = anonymizedUser("22222222");
    expect(a.name).toBeNull();
    expect(a.avatarUrl).toBeNull();
    expect(a.email).toBe("deleted-11111111@anonymized.invalid");
    expect(a.email).not.toBe(b.email);
  });
});
