import { getDb } from "@/db";
import { confirmDeletion, previewDeletion, requestDeletionCode } from "./auth/delete-account";
import { sendMail } from "./auth/mail";

/** App-facing bindings (real database and mailer) for the account deletion flow; the logic is in auth/delete-account.ts. */
export const getDeletionPreview = (userId: string) => previewDeletion(getDb(), userId);
export const sendDeletionCodeTo = (userId: string) => requestDeletionCode(getDb(), userId, sendMail);
export const deleteAccountWithCode = (userId: string, input: { code: string; confirmation: string }) => confirmDeletion(getDb(), userId, input);
