import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/icons/icon-192.png"
        alt=""
        width={28}
        height={28}
        className="size-7 rounded-md"
        priority
      />
      {showName && <span className="text-base font-semibold tracking-tight">Compasso</span>}
    </span>
  );
}
