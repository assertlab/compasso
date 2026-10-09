import Link from "next/link";
import { Logo } from "@/components/logo";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarNav } from "@/components/sidebar-nav";
import { VersionBadge } from "@/components/version-badge";
import { isAdminSession } from "@/server/session-role";

/** Fixed left menu from `lg` up. Reads the session (role), so render it behind Suspense (Next 16 cacheComponents). */
export async function AppSidebar() {
  const isAdmin = await isAdminSession();
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r bg-background lg:flex">
      <div className="flex h-14 shrink-0 items-center gap-2 px-5">
        <Link href="/" aria-label="Compasso — início">
          <Logo />
        </Link>
        <VersionBadge />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <SidebarNav isAdmin={isAdmin} />
      </div>
    </aside>
  );
}

/** The hamburger for screens below `lg`; same role lookup, same Suspense requirement. */
export async function AppMobileNav() {
  return <MobileNav isAdmin={await isAdminSession()} />;
}
