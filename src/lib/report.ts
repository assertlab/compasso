/** One finished time entry with its catalog names resolved, ready to be aggregated. */
export type ReportRow = {
  id: string;
  userId: string;
  userName: string;
  clientId: string | null;
  clientName: string | null;
  projectId: string | null;
  projectName: string | null;
  taskId: string | null;
  taskName: string | null;
  description: string;
  startedAt: Date;
  endedAt: Date;
  seconds: number;
  /** An admin changed this entry after it was logged (ADR-030). */
  corrected: boolean;
};

/** What the lowest level of the summary groups by (the URL param is `agrupar`). */
export const GROUP_BY = ["descricao", "tarefa"] as const;
export type GroupBy = (typeof GROUP_BY)[number];
export const DEFAULT_GROUP_BY: GroupBy = "descricao";
export const GROUP_LABELS: Record<GroupBy, string> = { descricao: "Descrição", tarefa: "Tarefa" };

/** Lowest summary level: a task or a description, depending on `GroupBy`. */
export type LeafTotal = { id: string | null; name: string; seconds: number; entries: number };
export type ProjectTotal = { id: string | null; name: string; seconds: number; entries: number; items: LeafTotal[] };
export type ClientTotal = { id: string | null; name: string; seconds: number; entries: number; projects: ProjectTotal[] };
export type PersonTotal = { id: string; name: string; seconds: number; entries: number };

export type ReportSummary = {
  groupBy: GroupBy;
  totalSeconds: number;
  totalEntries: number;
  clients: ClientTotal[];
  people: PersonTotal[];
};

export const NO_PROJECT_LABEL = "Sem projeto";
export const NO_TASK_LABEL = "Sem tarefa";
export const NO_DESCRIPTION_LABEL = "Sem descrição";

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
/** Name order, but the synthetic "no project / no task" bucket always goes last. */
const orderBuckets = <T extends { id: string | null; name: string }>(list: T[]) =>
  list.sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : byName(a, b)));

/** Same words typed with different case or spacing are one activity ("Reunião  3C" = "reunião 3c"). */
export const normalizeDescription = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Client > project > task totals plus per-person totals. Entries without a project form a single
 * "Sem projeto" client (never silently dropped, so the grand total always matches the rows);
 * entries with a project but no task form a "Sem tarefa" bucket inside that project. With `groupBy: "descricao"`
 * the lowest level is the description instead (case and spacing ignored; empty ones form "Sem descrição").
 */
export function summarize(rows: ReportRow[], groupBy: GroupBy = DEFAULT_GROUP_BY): ReportSummary {
  const clients = new Map<string, ClientTotal>();
  const people = new Map<string, PersonTotal>();
  let totalSeconds = 0;

  for (const r of rows) {
    totalSeconds += r.seconds;

    const p = people.get(r.userId) ?? { id: r.userId, name: r.userName, seconds: 0, entries: 0 };
    p.seconds += r.seconds;
    p.entries += 1;
    people.set(r.userId, p);

    const clientKey = r.projectId ? (r.clientId ?? "?") : "none";
    let client = clients.get(clientKey);
    if (!client) {
      client = {
        id: r.projectId ? r.clientId : null,
        name: r.projectId ? (r.clientName ?? "—") : NO_PROJECT_LABEL,
        seconds: 0,
        entries: 0,
        projects: [],
      };
      clients.set(clientKey, client);
    }
    client.seconds += r.seconds;
    client.entries += 1;

    // A "Sem projeto" client has a single synthetic project so the three levels stay uniform.
    let project = client.projects.find((x) => x.id === r.projectId);
    if (!project) {
      project = { id: r.projectId, name: r.projectName ?? NO_PROJECT_LABEL, seconds: 0, entries: 0, items: [] };
      client.projects.push(project);
    }
    project.seconds += r.seconds;
    project.entries += 1;

    const leaf =
      groupBy === "tarefa"
        ? { id: r.taskId, name: r.taskName ?? NO_TASK_LABEL }
        : { id: normalizeDescription(r.description) || null, name: r.description.trim().replace(/\s+/g, " ") || NO_DESCRIPTION_LABEL };
    let item = project.items.find((x) => x.id === leaf.id);
    if (!item) {
      item = { ...leaf, seconds: 0, entries: 0 };
      project.items.push(item);
    }
    item.seconds += r.seconds;
    item.entries += 1;
  }

  const clientList = orderBuckets([...clients.values()]);
  for (const c of clientList) {
    orderBuckets(c.projects);
    for (const p of c.projects) orderBuckets(p.items);
  }
  return {
    groupBy,
    totalSeconds,
    totalEntries: rows.length,
    clients: clientList,
    people: [...people.values()].sort(byName),
  };
}
