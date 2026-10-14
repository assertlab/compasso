import type { DeletionCodeResult, DeletionResult } from "@/server/auth/delete-account";

const list = (names: string[]) => names.map((n) => `"${n}"`).join(", ");
const blocked = (names: string[]) => `Você é a única pessoa administradora de ${list(names)}. Promova outra pessoa a administradora antes de excluir a conta.`;

/** pt-BR text for a refused code request. */
export function codeRefusalMessage(result: Exclude<DeletionCodeResult, { ok: true }>): string {
  switch (result.reason) {
    case "rate-limited":
      return `Muitos códigos pedidos. Tente de novo em ${Math.max(1, Math.ceil(result.retryAfterSeconds / 60))} min.`;
    case "blocked":
      return blocked(result.workspaces);
    case "not-found":
      return "Esta conta não está mais disponível.";
  }
}

/** pt-BR text for a refused deletion. */
export function deletionRefusalMessage(result: Exclude<DeletionResult, { ok: true }>): string {
  switch (result.reason) {
    case "blocked":
      return blocked(result.workspaces);
    case "wrong-confirmation":
      return "Digite EXCLUIR, em maiúsculas, para confirmar.";
    case "wrong-code":
      return "Código incorreto.";
    case "expired":
      return "O código expirou. Peça um novo.";
    case "too-many-attempts":
      return "Muitas tentativas com este código. Peça um novo.";
    case "no-code":
      return "Peça um código por e-mail primeiro.";
    case "not-found":
      return "Esta conta não está mais disponível.";
  }
}
