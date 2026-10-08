"use client";

import { BarChart3, Building2, CalendarDays, Clock, FolderKanban, LayoutDashboard, Tag, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { isNavActive, navGroupsFor, type NavIcon } from "@/lib/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<NavIcon, LucideIcon> = {
  registros: Clock,
  calendario: CalendarDays,
  painel: LayoutDashboard,
  relatorios: BarChart3,
  clientes: Building2,
  projetos: FolderKanban,
  tags: Tag,
  membros: Users,
};

/** The main menu, shared by the fixed sidebar and the mobile drawer. Marks the current page with aria-current. */
export function SidebarNav({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const aba = useSearchParams().get("aba");

  return (
    <nav aria-label="Principal" className="grid gap-1">
      {navGroupsFor(isAdmin).map((group, index) => (
        <div key={group.label ?? index} className="grid gap-0.5">
          {group.label && <p className="px-3 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</p>}
          <ul className="grid gap-0.5">
            {group.items.map((item) => {
              const active = isNavActive(item, pathname, aba);
              const Icon = ICONS[item.id];
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                      active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
