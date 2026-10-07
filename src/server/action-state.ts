import { ZodError } from "zod";
import { isUniqueViolation } from "./db-errors";
import { ForbiddenError, NotFoundError } from "./errors";

/** What a Server Action returns to its form (useActionState). Only serializable data. */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const idle: ActionState = { ok: false };

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
  if (error instanceof ForbiddenError) return { ok: false, message: "Apenas administradores podem alterar os cadastros." };
  if (error instanceof NotFoundError) return { ok: false, message: "Item não encontrado. Atualize a página e tente de novo." };
  if (isUniqueViolation(error)) {
    return { ok: false, fieldErrors: { name: "Já existe um item com este nome." } };
  }
  console.error("catalog action failed", error);
  return { ok: false, message: "Não foi possível salvar. Tente novamente." };
}
