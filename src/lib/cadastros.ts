export const TABS = [
  { key: "clientes", label: "Clientes" },
  { key: "projetos", label: "Projetos" },
  { key: "tags", label: "Tags" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

/** Reads the `aba` query parameter; anything unknown falls back to the first tab. */
export function parseTab(value: string | string[] | undefined): TabKey {
  const raw = Array.isArray(value) ? value[0] : value;
  return TABS.find((tab) => tab.key === raw)?.key ?? TABS[0].key;
}
