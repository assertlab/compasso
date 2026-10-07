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
};

export type TaskTotal = { id: string | null; name: string; seconds: number; entries: number };
export type ProjectTotal = { id: string | null; name: string; seconds: number; entries: number; tasks: TaskTotal[] };
export type ClientTotal = { id: string | null; name: string; seconds: number; entries: number; projects: ProjectTotal[] };
export type PersonTotal = { id: string; name: string; seconds: number; entries: number };

export type ReportSummary = {
  totalSeconds: number;
  totalEntries: number;
  clients: ClientTotal[];
  people: PersonTotal[];
};

export const NO_PROJECT_LABEL = "Sem projeto";
export const NO_TASK_LABEL = "Sem tarefa";

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
/** Name order, but the synthetic "no project / no task" bucket always goes last. */
const orderBuckets = <T extends { id: string | null; name: string }>(list: T[]) =>
  list.sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : byName(a, b)));

/**
 * Client > project > task totals plus per-person totals. Entries without a project form a single
 * "Sem projeto" client (never silently dropped, so the grand total always matches the rows);
 * entries with a project but no task form a "Sem tarefa" bucket inside that project.
 */
export function summarize(rows: ReportRow[]): ReportSummary {
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
      project = { id: r.projectId, name: r.projectName ?? NO_PROJECT_LABEL, seconds: 0, entries: 0, tasks: [] };
      client.projects.push(project);
    }
    project.seconds += r.seconds;
    project.entries += 1;

    let task = project.tasks.find((x) => x.id === r.taskId);
    if (!task) {
      task = { id: r.taskId, name: r.taskName ?? NO_TASK_LABEL, seconds: 0, entries: 0 };
      project.tasks.push(task);
    }
    task.seconds += r.seconds;
    task.entries += 1;
  }

  const clientList = orderBuckets([...clients.values()]);
  for (const c of clientList) {
    orderBuckets(c.projects);
    for (const p of c.projects) orderBuckets(p.tasks);
  }
  return {
    totalSeconds,
    totalEntries: rows.length,
    clients: clientList,
    people: [...people.values()].sort(byName),
  };
}
