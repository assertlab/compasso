import { z } from "zod";
import { PERIOD_PRESETS } from "../report-period";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Report filters as they travel in the URL (and later in the export request). Everything is optional:
 * no client/project/task means "all"; `projeto=none` selects entries without a project; no `pessoas`
 * means everyone the caller may see (admins: all members; members: only themselves).
 */
export const reportQuery = z.object({
  periodo: z.enum(PERIOD_PRESETS).catch("mes"),
  de: date.optional().catch(undefined),
  ate: date.optional().catch(undefined),
  cliente: z.uuid().optional().catch(undefined),
  projeto: z.union([z.uuid(), z.literal("none")]).optional().catch(undefined),
  tarefa: z.uuid().optional().catch(undefined),
  pessoas: z.array(z.uuid()).max(100).catch([]),
});
export type ReportQuery = z.infer<typeof reportQuery>;

/** Next.js search params (string | string[] | undefined) -> validated query. `pessoas` is repeated or comma-separated. */
export function parseReportQuery(sp: Record<string, string | string[] | undefined>): ReportQuery {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const people = [sp.pessoas ?? []].flat().flatMap((v) => v.split(",")).filter(Boolean);
  return reportQuery.parse({
    periodo: first(sp.periodo),
    de: first(sp.de),
    ate: first(sp.ate),
    cliente: first(sp.cliente),
    projeto: first(sp.projeto),
    tarefa: first(sp.tarefa),
    pessoas: [...new Set(people)],
  });
}

/** The query back as URL params (only what is set), e.g. to link to the export with the same filters. */
export function toSearchParams(q: ReportQuery): URLSearchParams {
  const params = new URLSearchParams({ periodo: q.periodo });
  for (const [key, value] of [["de", q.de], ["ate", q.ate], ["cliente", q.cliente], ["projeto", q.projeto], ["tarefa", q.tarefa]] as const) {
    if (value) params.set(key, value);
  }
  for (const id of q.pessoas) params.append("pessoas", id);
  return params;
}
