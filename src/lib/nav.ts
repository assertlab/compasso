export type NavIcon = "registros" | "calendario" | "painel" | "relatorios" | "clientes" | "projetos" | "tags" | "membros";

export type NavItem = {
  id: NavIcon;
  label: string;
  href: string;
  /** For items that open a tab of /cadastros: the `aba` value that makes the item "current". */
  aba?: string;
  adminOnly?: boolean;
};
export type NavGroup = { label: string | null; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { id: "registros", label: "Registros", href: "/" },
      { id: "calendario", label: "Calendário", href: "/calendario" },
    ],
  },
  {
    label: "Analisar",
    items: [
      { id: "painel", label: "Painel", href: "/painel" },
      { id: "relatorios", label: "Relatórios", href: "/relatorios" },
    ],
  },
  {
    label: "Gerenciar",
    items: [
      { id: "clientes", label: "Clientes", href: "/cadastros?aba=clientes", aba: "clientes" },
      { id: "projetos", label: "Projetos", href: "/cadastros?aba=projetos", aba: "projetos" },
      { id: "tags", label: "Tags", href: "/cadastros?aba=tags", aba: "tags" },
      { id: "membros", label: "Membros", href: "/cadastros?aba=membros", aba: "membros", adminOnly: true },
    ],
  },
];

/** The menu the caller may see: admin-only items are left out for members. */
export function navGroupsFor(isAdmin: boolean): NavGroup[] {
  return GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => isAdmin || !i.adminOnly) }));
}

const FIRST_CADASTROS_TAB = "clientes";

/**
 * Whether `item` is the current page. Items of /cadastros match by tab (`aba`, defaulting to the first tab, like the page
 * does); a project's own page (/cadastros/projetos/<id>) counts as "Projetos".
 */
export function isNavActive(item: NavItem, pathname: string, aba: string | null): boolean {
  if (item.aba) {
    if (pathname === "/cadastros") return (aba ?? FIRST_CADASTROS_TAB) === item.aba;
    return item.aba === "projetos" && pathname.startsWith("/cadastros/projetos/");
  }
  return item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
