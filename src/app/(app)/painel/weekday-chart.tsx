"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeekdayChart } from "@/lib/report-weekdays";
import { formatHm } from "@/lib/report-days";
import { formatHms } from "@/lib/time";
import { BarPlot } from "../relatorios/charts";

type Mode = "total" | "media";

const plural = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

/**
 * Hours per day of the week (Sunday to Saturday). With one week there is nothing to average, so it shows the
 * total only; over longer periods a switch moves between the total and the average per day. Both views are
 * computed on the server; only the choice lives here.
 */
export function WeekdayChartCard({ chart }: { chart: WeekdayChart }) {
  const [choice, setChoice] = useState<Mode>("total");
  const mode: Mode = chart.hasAverage ? choice : "total";
  const average = mode === "media";

  const bars = chart.bars.map((b) => {
    const seconds = average ? b.averageSeconds : b.totalSeconds;
    const title = average
      ? `${b.name}: média de ${formatHms(b.averageSeconds)} por dia (${plural(b.days)}, ${formatHms(b.totalSeconds)} no total)`
      : `${b.name}: ${formatHms(b.totalSeconds)}${b.days > 1 ? ` em ${plural(b.days)}` : ""}`;
    return { key: String(b.weekday), label: b.label, title, seconds };
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Horas por dia da semana</CardTitle>
        {chart.hasAverage && (
          <div role="group" aria-label="Tipo de valor" className="flex gap-1">
            <Button type="button" size="sm" variant={average ? "outline" : "default"} aria-pressed={!average} onClick={() => setChoice("total")}>
              Soma
            </Button>
            <Button type="button" size="sm" variant={average ? "default" : "outline"} aria-pressed={average} onClick={() => setChoice("media")}>
              Média por dia
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <BarPlot bars={bars} max={Math.max(1, ...bars.map((b) => b.seconds))} valueLabel={formatHm} />
        {average && (
          <p className="text-xs text-muted-foreground">
            Média = horas de cada dia da semana ÷ quantos desses dias já passaram no período, contando os sem registro como zero.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
