import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { axisTicks, formatAxisHours, formatPercent, OTHERS_ID, type BarItem, type ReportCharts, type ShareItem } from "@/lib/report-charts";
import { formatHms } from "@/lib/time";

const PLOT_HEIGHT = "h-40";

/**
 * Charts for the report. Plain HTML/CSS (no chart library): every bar is a real element, the values are also
 * text, and the table views below ("Por dia", the summary) carry the exact numbers. One hue (the brand
 * primary) because bars compare magnitude; the red is never used here (ADR-016).
 */
export function ReportChartsSection({ charts, activityTitle, showPeople }: { charts: ReportCharts; activityTitle: string; showPeople: boolean }) {
  return (
    <>
      <BarsCard charts={charts} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SharesCard title="Por projeto" items={charts.projects} />
        <SharesCard title={activityTitle} items={charts.activities} />
      </div>
      {showPeople && charts.people.length > 1 && <SharesCard title="Por pessoa" items={charts.people} />}
    </>
  );
}

const barTitle = (b: BarItem, granularity: ReportCharts["granularity"]) =>
  `${granularity === "dia" ? `${b.sublabel}, ${b.label}` : `Semana de ${b.label} ${b.sublabel}`}: ${formatHms(b.seconds)}`;

function BarsCard({ charts }: { charts: ReportCharts }) {
  const { bars, granularity } = charts;
  const ticks = axisTicks(charts.barMax);
  const top = ticks[ticks.length - 1] || 1;
  const labelEvery = Math.ceil(bars.length / 7);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Horas por {granularity === "dia" ? "dia" : "semana"}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[auto_1fr] gap-x-2">
          {/* y axis */}
          <div className={`relative ${PLOT_HEIGHT} w-9 text-right text-[11px] text-muted-foreground`} aria-hidden>
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 -translate-y-1/2 leading-none" style={{ bottom: `${(t / top) * 100}%` }}>
                {formatAxisHours(t)}
              </span>
            ))}
          </div>

          {/* plot */}
          <div className={`relative ${PLOT_HEIGHT}`}>
            {ticks.map((t) => (
              <div key={t} aria-hidden className="absolute inset-x-0 border-t border-border" style={{ bottom: `${(t / top) * 100}%` }} />
            ))}
            <ul className="absolute inset-0 flex items-end">
              {bars.map((b) => (
                <li key={b.key} title={barTitle(b, granularity)} className="flex h-full flex-1 items-end justify-center hover:bg-muted/60">
                  <span className="sr-only">{barTitle(b, granularity)}</span>
                  {b.seconds > 0 && (
                    <span
                      aria-hidden
                      className="w-full max-w-6 rounded-t-[4px] bg-primary"
                      style={{ height: `max(2px, ${(b.seconds / top) * 100}%)`, marginInline: "1px" }}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* x axis */}
          <div />
          <ul aria-hidden className="mt-1 flex h-4 text-[11px] text-muted-foreground">
            {bars.map((b, i) => (
              <li key={b.key} className="relative flex-1">
                {i % labelEvery === 0 && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{b.label}</span>}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function SharesCard({ title, items }: { title: string; items: ShareItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.seconds));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-3">
          {items.map((i) => (
            <li key={i.id} title={`${i.label}: ${formatHms(i.seconds)} (${formatPercent(i.percent)})`} className="grid min-w-0 grid-cols-1 gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {i.label}
                  {i.sublabel && <span className="ml-2 text-xs text-muted-foreground">{i.sublabel}</span>}
                </span>
                <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                  {formatHms(i.seconds)} · <span className="text-foreground">{formatPercent(i.percent)}</span>
                </span>
              </div>
              <div aria-hidden className="h-2 rounded-[4px] bg-muted">
                <div
                  className={`h-full rounded-[4px] ${i.id === OTHERS_ID ? "bg-muted-foreground/50" : "bg-primary"}`}
                  style={{ width: `${Math.max(1, (i.seconds / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
