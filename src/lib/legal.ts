/** Who answers for the service and where to reach them. Shown on the access, terms and privacy pages. */
export const SERVICE_NAME = "Compasso";
export const RESPONSIBLE = "ASSERT Lab, grupo de pesquisa do CIn/UFPE";
/** Public contact: access requests and data-subject requests (privacy). The mailbox must exist and be read. */
export const CONTACT_EMAIL = "contato@assertlab.com";

/** Public routes of the Terms of Use and the Privacy Policy (ADR-039). */
export const LEGAL_PATHS = { terms: "/termos", privacy: "/privacidade" } as const;

/**
 * Version of both texts, as an ISO date. Bump it whenever either text changes in a way people should know about:
 * it is printed on both pages and on the sign-in notice. Acceptance is not stored (ADR-039), so this is the only trace.
 */
export const LEGAL_VERSION = "2026-10-14";

/** Minimum age to use the service. */
export const MIN_AGE = 18;

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-10-14" → "14 de outubro de 2026". Pure string work: no Date, so the result never shifts with the time zone. */
export function formatLegalVersion(iso: string = LEGAL_VERSION): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
  if (!match || !month) throw new Error(`Invalid legal version date: ${iso}`);
  return `${Number(match[3])} de ${month} de ${match[1]}`;
}

export type Processor = { name: string; purpose: string; where: string };

/**
 * Companies that process personal data on our behalf (the Privacy Policy lists them; keep it in sync with the real stack).
 * Google and GitHub are not processors in the strict sense, they are the sign-in options the person chooses.
 */
export const PROCESSORS: readonly Processor[] = [
  { name: "Neon", purpose: "Banco de dados onde ficam todos os dados do serviço.", where: "Estados Unidos (AWS, região us-east-2, Ohio)" },
  { name: "Vercel", purpose: "Hospedagem do aplicativo e registros técnicos de funcionamento (logs).", where: "Empresa dos Estados Unidos; o processamento pode ocorrer fora do Brasil" },
  { name: "Resend", purpose: "Envio dos e-mails de código de acesso e de convite.", where: "Empresa dos Estados Unidos; o processamento pode ocorrer fora do Brasil" },
  { name: "Cloudflare", purpose: "Verificação anti-robô na entrada (Turnstile), DNS do domínio e encaminhamento do e-mail de contato.", where: "Empresa dos Estados Unidos, com rede em vários países" },
  { name: "Google e GitHub", purpose: "Somente se você escolher entrar com a sua conta deles: confirmam quem você é e informam e-mail, nome e foto.", where: "Empresas dos Estados Unidos" },
];
