import Link from "next/link";
import { Suspense } from "react";
import { AccountMenu } from "@/components/account-menu";
import { AppMobileNav } from "@/components/app-sidebar";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { VersionBadge } from "@/components/version-badge";

/** Top bar: hamburger and logo below `lg` (the menu lives in the sidebar from `lg`), workspace, theme and account always. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="flex min-h-14 w-full items-center gap-2 px-4 py-2">
        <Suspense fallback={<div className="size-9 shrink-0 lg:hidden" aria-hidden />}>
          <AppMobileNav />
        </Suspense>
        <Link href="/" aria-label="Compasso — início" className="shrink-0 lg:hidden">
          <Logo />
        </Link>
        <VersionBadge className="lg:hidden" />
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
