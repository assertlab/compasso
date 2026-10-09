import { ZodError } from "zod";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { isInvalidInput, isUniqueViolation, pgErrorCode } from "./db-errors";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";

/** What a Server Action returns to its form (useActionState). Only serializable data. */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const idle: ActionState = { ok: false };

/**
 * Logs a failure without personal data (COMP-006). A `DrizzleQueryError` carries the SQL *and its parameters* (entry
 * descriptions, names, ids) in `message` and `stack`, and Vercel keeps logs outside the app's LGPD controls, so database
 * errors are reduced to class, SQLSTATE and constraint name. Our own errors keep message and stack.
 */
export function describeError(error: unknown) {
  const db = error instanceof DrizzleQueryError || pgErrorCode(error) !== undefined;
  if (db) {
    const cause = (error as { cause?: { constraint?: unknown } }).cause;
    return { kind: "database", name: error instanceof Error ? error.name : typeof error, code: pgErrorCode(error), constraint: typeof cause?.constraint === "string" ? cause.constraint : undefined };
  }
  return error instanceof Error ? { kind: "error", name: error.name, message: error.message, stack: error.stack } : { kind: "unknown", value: typeof error };
}

/** Turns anything thrown while saving into a user-facing (pt-BR) state. Unknown errors are logged, never shown. */
export function toActionState(error: unknown): ActionState {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, fieldErrors };
  }
  if (error instanceof ValidationError) return { ok: false, fieldErrors: error.fieldErrors };
  if (error instanceof ConflictError) return { ok: false, message: error.message };
  if (error instanceof ForbiddenError) return { ok: false, message: "Apenas administradores podem alterar os cadastros." };
  // A malformed id (tampered form or action argument) is "not found", not a server error.
  if (error instanceof NotFoundError || isInvalidInput(error)) return { ok: false, message: "Item não encontrado. Atualize a página e tente de novo." };
  if (isUniqueViolation(error)) {
    return { ok: false, fieldErrors: { name: "Já existe um item com este nome." } };
  }
  console.error("catalog action failed", describeError(error));
  return { ok: false, message: "Não foi possível salvar. Tente novamente." };
}
