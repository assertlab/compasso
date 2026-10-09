import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { describeError, toActionState } from "./action-state";
import { isUniqueViolation } from "./db-errors";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";

describe("isUniqueViolation", () => {
  it("detects the Postgres code, also when wrapped in a cause chain", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation(new Error("wrapped", { cause: { code: "23505" } }))).toBe(true);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(new Error("plain"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe("toActionState", () => {
  it("passes business-rule errors through to the form", () => {
    expect(toActionState(new ValidationError({ endedAt: "Fim inválido" }))).toEqual({
      ok: false,
      fieldErrors: { endedAt: "Fim inválido" },
    });
    expect(toActionState(new ConflictError("Já há um timer rodando")).message).toBe("Já há um timer rodando");
  });

  it("maps Zod issues to the first message per field", () => {
    const result = z.object({ name: z.string().min(1, "Informe um nome") }).safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toActionState(result.error)).toEqual({ ok: false, fieldErrors: { name: "Informe um nome" } });
    }
  });

  it("explains permission, missing item and duplicate name errors", () => {
    expect(toActionState(new ForbiddenError()).message).toMatch(/administradores/);
    expect(toActionState(new NotFoundError("Project")).message).toMatch(/não encontrado/i);
    expect(toActionState({ code: "23505" }).fieldErrors).toEqual({ name: "Já existe um item com este nome." });
  });

  it("hides unknown errors from the user but logs them", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const state = toActionState(new Error("connection string leaked: postgres://..."));
    expect(state).toEqual({ ok: false, message: "Não foi possível salvar. Tente novamente." });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("treats a malformed id (invalid uuid) as not found, not as a server error", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = new DrizzleQueryError("select * from time_entries where id = $1", ["not-a-uuid"], Object.assign(new Error("invalid input syntax for type uuid"), { code: "22P02" }));
    expect(toActionState(bad).message).toMatch(/não encontrado/i);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("never logs SQL parameters (COMP-006)", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const secret = "Reunião com o cliente Fulano sobre contrato";
    const err = new DrizzleQueryError("insert into time_entries (description) values ($1)", [secret], Object.assign(new Error("boom"), { code: "XX000" }));
    toActionState(err);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain(secret);
    expect(logged).not.toContain("insert into");
    expect(logged).toContain("XX000");
    log.mockRestore();
  });

  it("describeError keeps message and stack for our own errors only", () => {
    expect(describeError(new Error("ours"))).toMatchObject({ kind: "error", message: "ours" });
    const db = describeError(new DrizzleQueryError("select 1", ["x"], undefined));
    expect(db).toEqual({ kind: "database", name: "Error", code: undefined, constraint: undefined });
  });
});
