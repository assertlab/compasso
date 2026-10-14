import Link from "next/link";
import { LEGAL_PATHS } from "@/lib/legal";
import { cn } from "@/lib/utils";

/** Links to the Terms and the Privacy Policy, for the footer. Server-safe: no hooks, no state. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Documentos legais" className={cn("flex flex-wrap items-center justify-center gap-x-2", className)}>
      <Link href={LEGAL_PATHS.terms} className="underline underline-offset-4 hover:text-foreground">
        Termos de Uso
      </Link>
      <span aria-hidden>·</span>
      <Link href={LEGAL_PATHS.privacy} className="underline underline-offset-4 hover:text-foreground">
        Política de Privacidade
      </Link>
    </nav>
  );
}
