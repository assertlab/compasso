import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { layoutDay } from "@/lib/calendar-layout";
import { formatDayLabel, weekStart } from "@/lib/entry-groups";
import { addDays, formatHms, localDateString, zonedDayRange, zonedMidnightUtc } from "@/lib/time";
import { getTenant } from "@/server/get-tenant";
import { loadCatalog, toEntryView } from "../views";
import { WeekGrid, type GridDay } from "./week-grid";

export const metadata: Metadata = { title: "Calendário" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `?semana=YYYY-MM-DD` (any day of the week); invalid or missing means the current week. */
function parseDate(value: string | string[] | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || !DATE_RE.test(v)) return null;
  return Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? null : v;
}

export default function CalendarPage({ searchParams }: PageProps<"/calendario">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" aria-hidden />}>
      <Calendar searchParams={searchParams} />
    </Suspense>
  );
}

async function Calendar({ searchParams }: Pick<PageProps<"/calendario">, "searchParams">) {
  const requested = parseDate((await searchParams).semana);
  const { ctx, tenant } = await getTenant();
  const tz = ctx.timezone;
  const now = new Date();
  const today = localDateString(now, tz);
  const week = weekStart(requested ?? today);
  const nextWeek = addDays(week, 7);

  const [catalog, entries] = await Promise.all([
    loadCatalog(tenant),
    tenant.timeEntries.list({ from: zonedMidnightUtc(week, tz), to: zonedMidnightUtc(nextWeek, tz) }),
  ]);
  const views = entries.map((e) => toEntryView(e, tz));

  const days: GridDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(week, i);
    const { from, to } = zonedDayRange(date, tz);
    return {
      date,
      label: formatDayLabel(date),
      isToday: date === today,
      isWeekend: i >= 5,
      totalSeconds: views.filter((v) => v.date === date).reduce((sum, v) => sum + (v.durationSeconds ?? 0), 0),
      blocks: layoutDay(views, from, to, now),
    };
  });
  const weekTotal = days.reduce((sum, d) => sum + d.totalSeconds, 0);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendário</h1>
          <p className="text-sm text-muted-foreground">
            {formatDayLabel(week)} – {formatDayLabel(addDays(week, 6))} · Total:{" "}
            <span className="font-mono tabular-nums">{formatHms(weekTotal)}</span>
          </p>
        </div>
        <nav aria-label="Semana" className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/calendario?semana=${addDays(week, -7)}`}>Anterior</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/calendario">Hoje</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/calendario?semana=${nextWeek}`}>Próxima</Link>
          </Button>
        </nav>
      </div>

      <WeekGrid days={days} catalog={catalog} today={today} />

      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground sm:hidden">
        A grade do calendário é para telas maiores. No celular, use a lista em{" "}
        <Link href="/" className="underline">
          Registros
        </Link>
        .
      </p>
    </section>
  );
}
