import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { toActionState } from "./action-state";
import { isUniqueViolation } from "./db-errors";
import { ForbiddenError, NotFoundError } from "./errors";

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
});
