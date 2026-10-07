import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { NavLinks } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      {/* On narrow screens the nav drops to its own row so nothing overlaps; from sm it sits between logo and controls. */}
      <div className="mx-auto flex min-h-14 w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
        <Link href="/" aria-label="Compasso — início" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="order-last w-full overflow-x-auto sm:order-none sm:ml-2 sm:w-auto sm:flex-1 sm:border-l sm:pl-4">
          {/* usePathname reads the URL on the client: keep it behind Suspense (Next 16 cacheComponents). */}
          <Suspense fallback={<div className="h-8 w-64 animate-pulse rounded-md bg-muted" aria-hidden />}>
            <NavLinks />
          </Suspense>
        </nav>
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
