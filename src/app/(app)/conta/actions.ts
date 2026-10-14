"use server";

import { redirect } from "next/navigation";
import { codeRefusalMessage, deletionRefusalMessage } from "@/lib/delete-account-messages";
import { describeError, type ActionState } from "@/server/action-state";
import { deleteAccountWithCode, sendDeletionCodeTo } from "@/server/account-deletion";
import { requireWorkspaceContext } from "@/server/workspace-context";

export type DeleteAccountState = ActionState & { codeSent?: boolean };

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/** Step 1: mails a confirmation code to the account address. The person is the session's, never an id from the form. */
export async function sendDeletionCode(): Promise<DeleteAccountState> {
  const { userId } = await requireWorkspaceContext();
  try {
    const result = await sendDeletionCodeTo(userId);
    if (!result.ok) return { ok: false, message: codeRefusalMessage(result) };
    return { ok: true, codeSent: true };
  } catch (error) {
    console.error("delete-account: sending the code failed", describeError(error));
    return { ok: false, message: "Não foi possível enviar o código. Tente novamente." };
  }
}

/** Step 2: code + typed word. On success the person is gone and lands on the sign-in page. */
export async function deleteMyAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const { userId } = await requireWorkspaceContext();
  let result;
  try {
    result = await deleteAccountWithCode(userId, { code: text(formData, "code"), confirmation: text(formData, "confirmation") });
  } catch (error) {
    console.error("delete-account: erasure failed", describeError(error));
    return { ok: false, codeSent: true, message: "Não foi possível excluir a conta. Tente novamente: o processo continua de onde parou." };
  }
  if (!result.ok) return { ok: false, codeSent: result.reason !== "no-code" && result.reason !== "expired" && result.reason !== "too-many-attempts", message: deletionRefusalMessage(result) };
  // Outside the try/catch: redirect() throws. Sessions went with the identity data, so this is a clean sign-out.
  redirect("/sign-in?deleted=1");
}
