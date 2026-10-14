import type { ReactNode } from "react";
import { CONTACT_EMAIL, formatLegalVersion } from "@/lib/legal";

/** Page frame for a legal text: title, version line and an optional plain-language summary. */
export function LegalDoc({ title, summary, children }: { title: string; summary?: ReactNode; children: ReactNode }) {
  return (
    <article className="grid gap-6">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">Versão de {formatLegalVersion()}</p>
      </header>
      {summary && <div className="rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed">{summary}</div>}
      {children}
    </article>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed">{children}</p>;
}

export function Ul({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">{children}</ul>;
}

export function ContactLink({ subject }: { subject?: string }) {
  const href = `mailto:${CONTACT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  return (
    <a className="font-medium underline underline-offset-4" href={href}>
      {CONTACT_EMAIL}
    </a>
  );
}
