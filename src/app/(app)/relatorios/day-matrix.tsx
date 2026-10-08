import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DayMatrix } from "@/lib/report-days";
import { formatHms } from "@/lib/time";
import { cn } from "@/lib/utils";

const cell = (seconds: number) => (seconds === 0 ? <span className="text-muted-foreground">—</span> : formatHms(seconds));

/**
 * Project (and person) × day grid, like Clockify's weekly report. First column stays visible while the days
 * scroll sideways, so a month still reads on a phone.
 */
export function DayMatrixCard({ matrix }: { matrix: DayMatrix }) {
  const title = matrix.granularity === "dia" ? "Por dia" : "Por semana";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {matrix.granularity === "semana" && <p className="text-sm text-muted-foreground">Período longo: colunas por semana (segunda a domingo).</p>}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="sticky left-0 z-[1] bg-card py-2 pr-4 text-left font-medium">Projeto</th>
              {matrix.columns.map((c) => (
                <th key={c.key} className="min-w-20 px-2 py-2 text-right font-medium">
                  <span className="block leading-tight">{c.label}</span>
                  <span className="block font-normal leading-tight">{c.sublabel}</span>
                </th>
              ))}
              <th className="min-w-20 px-2 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.id} className="border-b last:border-b-0">
                <td className={cn("sticky left-0 z-[1] bg-card py-1.5 pr-4", row.level === 0 ? "font-medium" : "pl-4 text-muted-foreground")}>
                  <span className="block max-w-56 truncate">{row.label}</span>
                  {row.sublabel && <span className="block max-w-56 truncate text-xs font-normal text-muted-foreground">{row.sublabel}</span>}
                </td>
                {row.cells.map((seconds, i) => (
                  <td key={matrix.columns[i].key} className={cn("px-2 py-1.5 text-right font-mono tabular-nums", row.level === 1 && "text-muted-foreground")}>
                    {cell(seconds)}
                  </td>
                ))}
                <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums", row.level === 0 && "font-semibold")}>{formatHms(row.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-semibold">
              <td className="sticky left-0 z-[1] bg-card py-2 pr-4">Totais</td>
              {matrix.totals.map((seconds, i) => (
                <td key={matrix.columns[i].key} className="px-2 py-2 text-right font-mono tabular-nums">
                  {cell(seconds)}
                </td>
              ))}
              <td className="px-2 py-2 text-right font-mono tabular-nums">{formatHms(matrix.grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}
