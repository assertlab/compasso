/**
 * Invitation e-mail text (audit COMP-004). Anyone can sign up, name a workspace and set their own display name, and the
 * mail leaves from the app's verified domain, so those names are attacker-controlled text. The subject is fixed; the names
 * only appear in the body, flattened to one line, stripped of links and phone-like numbers and cut short.
 */
export const INVITATION_SUBJECT = "Você recebeu um convite no Compasso";

const MAX_NAME = 60;

export function plainName(value: string | null | undefined): string {
  const cleaned = (value ?? "")
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > MAX_NAME ? `${cleaned.slice(0, MAX_NAME - 1).trimEnd()}…` : cleaned;
}

export function invitationText({ inviter, workspace, link }: { inviter: string | null | undefined; workspace: string | null | undefined; link: string }) {
  const who = plainName(inviter) || "Alguém";
  const where = plainName(workspace) || "um workspace";
  return `${who} convidou você para o workspace "${where}" no Compasso.\n\nAceite o convite: ${link}\n(expira em 48 horas)\n\nSe você não esperava este convite, ignore esta mensagem.`;
}
