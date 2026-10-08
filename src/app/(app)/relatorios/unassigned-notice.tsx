import Link from "next/link";
import type { ReportQuery } from "@/lib/schemas/report";

/**
 * Entries without a project cannot match a client filter, so they drop out of the numbers. Say so, with a link
 * that lists them (same period and people) in the report. `count` is 0 unless a client filter is hiding them.
 */
export function UnassignedNotice({ count, query }: { count: number; query: ReportQuery }) {
  if (count <= 0) return null;
  const params = new URLSearchParams({ periodo: query.periodo, projeto: "none" });
  if (query.de) params.set("de", query.de);
  if (query.ate) params.set("ate", query.ate);
  for (const id of query.pessoas) params.append("pessoas", id);

  return (
    <p className="rounded-md border bg-muted/50 p-3 text-sm">
      {count === 1 ? "1 registro sem projeto neste período não entra" : `${count} registros sem projeto neste período não entram`} no filtro de cliente.{" "}
      <Link href={`/relatorios?${params}`} className="underline">
        Ver registros sem projeto
      </Link>
    </p>
  );
}
