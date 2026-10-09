import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { VersionBadge } from "@/components/version-badge";

/** Centered page for the signed-out and onboarding screens: logo with version on top, footer at the bottom. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
        <div className="flex items-center gap-2">
          <Logo />
          <VersionBadge />
        </div>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
