import { copyrightYear } from "@/lib/app-info";
import { cn } from "@/lib/utils";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("mt-auto px-4 py-6 text-center text-xs text-muted-foreground", className)}>
      <p>© {copyrightYear()} ASSERT Lab. Licenciado sob MIT.</p>
      <p className="mt-0.5 font-medium text-foreground">
        Orgulhosamente feito em Recife <span aria-hidden>🦈</span>
      </p>
    </footer>
  );
}
