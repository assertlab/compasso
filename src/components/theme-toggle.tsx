"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const order = ["system", "light", "dark"] as const;
const labels = { system: "Tema: sistema", light: "Tema: claro", dark: "Tema: escuro" };

const subscribe = () => () => {};

export function ThemeToggle() {
  const { theme = "system", setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const current = mounted && (order as readonly string[]).includes(theme) ? (theme as (typeof order)[number]) : "system";
  const next = order[(order.indexOf(current) + 1) % order.length];
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`${labels[current]}. Alternar para ${labels[next].toLowerCase()}`}
      title={labels[current]}
    >
      <Icon aria-hidden />
    </Button>
  );
}
