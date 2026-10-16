import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/logo-mark";

export function Logo({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-7 shrink-0" />
      {showName && <span className="text-base font-semibold tracking-tight">Compasso</span>}
    </span>
  );
}
