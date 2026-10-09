import { Badge } from "@/components/ui/badge";
import { appVersionLabel } from "@/lib/app-info";
import { cn } from "@/lib/utils";

/** Always-visible app version (and commit outside production), next to the logo. */
export function VersionBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" title="Versão do Compasso" className={cn("font-mono text-[11px] font-normal text-muted-foreground tabular-nums", className)}>
      {appVersionLabel()}
    </Badge>
  );
}
