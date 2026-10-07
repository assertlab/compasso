export const TABS = [
  { key: "clientes", label: "Clientes", adminOnly: false },
  { key: "projetos", label: "Projetos", adminOnly: false },
  { key: "tags", label: "Tags", adminOnly: false },
  { key: "membros", label: "Membros", adminOnly: true },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

/** Tabs the caller may open: "Membros" is for admins only. */
export function tabsFor(isAdmin: boolean) {
  return TABS.filter((tab) => isAdmin || !tab.adminOnly);
}

/** Reads the `aba` query parameter; anything unknown (or not visible to the caller) falls back to the first tab. */
export function parseTab(value: string | string[] | undefined, isAdmin = false): TabKey {
  const raw = Array.isArray(value) ? value[0] : value;
  const tabs = tabsFor(isAdmin);
  return tabs.find((tab) => tab.key === raw)?.key ?? tabs[0].key;
}
