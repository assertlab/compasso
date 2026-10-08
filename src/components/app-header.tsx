import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { AppMobileNav } from "@/components/app-sidebar";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

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
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {/* Clerk's widgets read the pathname on the client: keep them behind Suspense (Next 16 cacheComponents). */}
          <Suspense fallback={<div className="h-9 w-40 animate-pulse rounded-md bg-muted" aria-hidden />}>
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/"
              afterCreateOrganizationUrl="/"
            />
          </Suspense>
          <ThemeToggle />
          <Suspense fallback={<div className="size-8 animate-pulse rounded-full bg-muted" aria-hidden />}>
            <UserButton />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
