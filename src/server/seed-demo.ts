import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { organizations, projectMembers, projects, tags, tasks, timeEntries, timeEntryTags, workspaceMembers } from "@/db/schema";
import { addDays, localDateString, zonedTimeToUtc } from "@/lib/time";

/** Fictional data for manual testing. Everything is tagged "demo"; client names end with " (demo)". */
export const DEMO_TAG = "demo";

const CLIENTS = [
  {
    name: "ASSERT Lab (demo)",
    projects: [
      { name: "Pesquisa em qualidade de software", color: "#8B5CF6", billable: false, tasks: ["Revisão de literatura", "Escrita de artigo", "Reunião de orientação"] },
      { name: "Infraestrutura do laboratório", color: "#64748B", billable: false, tasks: ["Manutenção de servidores", "Documentação"] },
    ],
  },
  {
    name: "Acme Consultoria (demo)",
    projects: [
      { name: "Portal do cliente", color: "#3B82F6", billable: true, tasks: ["Levantamento de requisitos", "Desenvolvimento front-end", "Revisão de código", "Homologação"] },
      { name: "Migração de dados", color: "#0EA5E9", billable: true, tasks: ["Mapeamento de tabelas", "Scripts de carga", "Validação"] },
    ],
  },
  {
    name: "Nova Energia (demo)",
    projects: [{ name: "Painel de indicadores", color: "#10B981", billable: true, tasks: ["Modelagem dos dados", "Dashboards", "Treinamento da equipe"] }],
  },
] as const;

const DESCRIPTIONS = ["Ajustes e correções", "Implementação", "Análise e planejamento", "Reunião de alinhamento", "Revisão", "Testes", "Documentação", "Pesquisa"];
const TAGS = [DEMO_TAG, "reunião", "desenvolvimento", "pesquisa"];

/** Small deterministic PRNG (mulberry32): the same seed always produces the same data. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

type Slot = { date: string; startMin: number; endMin: number };

/** 3 to 5 non-overlapping blocks per weekday, around lunch, between 08:00 and 19:00 local time. */
export function planDay(date: string, rand: () => number): Slot[] {
  const slots: Slot[] = [];
  let cursor = 8 * 60 + Math.floor(rand() * 5) * 6;
  const blocks = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < blocks; i++) {
    const duration = 45 + Math.floor(rand() * 11) * 9; // 45..135 min
    let end = cursor + duration;
    if (cursor < 12 * 60 && end > 12 * 60) {
      cursor = 13 * 60 + 30;
      end = cursor + duration;
    }
    if (end > 19 * 60) break;
    slots.push({ date, startMin: cursor, endMin: end });
    cursor = end + 5 + Math.floor(rand() * 5) * 5;
  }
  return slots;
}

export type DemoPlan = { clients: number; projects: number; tasks: number; entries: number; hours: number };
export type DemoResult = DemoPlan & { applied: boolean; skipped: boolean };

const isWeekday = (date: string) => ![0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());

export async function seedDemo(
  db: Db,
  { workspaceId, userId, timezone = "America/Recife", today = new Date(), days = 60, apply = false }: { workspaceId: string; userId: string; timezone?: string; today?: Date; days?: number; apply?: boolean },
): Promise<DemoResult> {
  const rand = prng(20261009);
  const lastDay = addDays(localDateString(today, timezone), -1); // never today: no clash with a real running timer
  const dates = Array.from({ length: days }, (_, i) => addDays(lastDay, -(days - 1 - i))).filter(isWeekday);

  const projectList = CLIENTS.flatMap((c) => c.projects.map((p) => ({ client: c.name, ...p })));
  const rows = dates.flatMap((date) =>
    planDay(date, rand).map((slot) => {
      const withoutProject = rand() < 0.06;
      const project = projectList[Math.floor(rand() * projectList.length)];
      const task = project.tasks[Math.floor(rand() * project.tasks.length)];
      const description = DESCRIPTIONS[Math.floor(rand() * DESCRIPTIONS.length)];
      const meeting = description.startsWith("Reunião");
      return {
        startedAt: zonedTimeToUtc(slot.date, hhmm(slot.startMin), timezone),
        endedAt: zonedTimeToUtc(slot.date, hhmm(slot.endMin), timezone),
        project: withoutProject ? null : project,
        task: withoutProject ? null : task,
        description: withoutProject ? "Triagem de e-mails" : description,
        isBillable: !withoutProject && project.billable && !meeting,
        tagNames: [DEMO_TAG, ...(meeting ? ["reunião"] : []), ...(!meeting && project.billable ? ["desenvolvimento"] : []), ...(project.name.startsWith("Pesquisa") ? ["pesquisa"] : [])],
      };
    }),
  );
  const plan: DemoPlan = {
    clients: CLIENTS.length,
    projects: projectList.length,
    tasks: projectList.reduce((n, p) => n + p.tasks.length, 0),
    entries: rows.length,
    hours: Math.round((rows.reduce((s, r) => s + (r.endedAt.getTime() - r.startedAt.getTime()), 0) / 3_600_000) * 10) / 10,
  };

  const [already] = await db.select({ id: tags.id }).from(tags).where(and(eq(tags.workspaceId, workspaceId), eq(tags.name, DEMO_TAG)));
  if (already) return { ...plan, applied: false, skipped: true };
  if (!apply) return { ...plan, applied: false, skipped: false };

  // neon-http has no interactive transactions: dependency order, each step one statement (safe to rerun after a failure
  // because the "demo" tag is created last and its presence is what marks the workspace as seeded).
  const orgRows = await db
    .insert(organizations)
    .values(CLIENTS.map((c) => ({ workspaceId, name: c.name })))
    .onConflictDoUpdate({ target: [organizations.workspaceId, organizations.name], set: { isArchived: false } })
    .returning();
  const orgByName = new Map(orgRows.map((o) => [o.name, o.id]));

  const projectRows = await db
    .insert(projects)
    .values(projectList.map((p) => ({ workspaceId, organizationId: orgByName.get(p.client)!, name: p.name, color: p.color })))
    .onConflictDoUpdate({ target: [projects.organizationId, projects.name], set: { isArchived: false } })
    .returning();
  const projectByName = new Map(projectRows.map((p) => [p.name, p.id]));

  const taskRows = await db
    .insert(tasks)
    .values(projectList.flatMap((p) => p.tasks.map((name) => ({ workspaceId, projectId: projectByName.get(p.name)!, name }))))
    .onConflictDoUpdate({ target: [tasks.projectId, tasks.name], set: { isCompleted: false } })
    .returning();
  const taskKey = (projectId: string, name: string) => `${projectId}|${name}`;
  const taskByKey = new Map(taskRows.map((t) => [taskKey(t.projectId, t.name), t.id]));

  // Everyone who is already an active member of the workspace takes part in the demo projects.
  const members = await db.select({ userId: workspaceMembers.userId }).from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
  await db
    .insert(projectMembers)
    .values(members.flatMap((m) => projectRows.map((p) => ({ workspaceId, projectId: p.id, userId: m.userId }))))
    .onConflictDoNothing();

  // A previous run may have died after inserting entries but before the marker tag: never insert the same entry twice.
  const existing = await db.select({ startedAt: timeEntries.startedAt }).from(timeEntries).where(and(eq(timeEntries.workspaceId, workspaceId), eq(timeEntries.userId, userId)));
  const taken = new Set(existing.map((e) => e.startedAt.getTime()));
  const fresh = rows.filter((r) => !taken.has(r.startedAt.getTime()));
  for (let i = 0; i < fresh.length; i += 100) {
    const chunk = fresh.slice(i, i + 100);
    await db.insert(timeEntries).values(
      chunk.map((r) => {
        const projectId = r.project ? projectByName.get(r.project.name)! : null;
        return {
          workspaceId,
          userId,
          projectId,
          taskId: projectId && r.task ? taskByKey.get(taskKey(projectId, r.task))! : null,
          description: r.description,
          startedAt: r.startedAt,
          endedAt: r.endedAt,
          timezone,
          isBillable: r.isBillable,
        };
      }),
    );
  }

  // The "demo" tag is the marker of a finished seed: created after the entries, then attached to them.
  await db.insert(tags).values(TAGS.map((name) => ({ workspaceId, name }))).onConflictDoNothing();
  // Read them back: `returning()` would only list the new rows, and the workspace may already have tags such as "reunião".
  const tagRows = await db.select().from(tags).where(eq(tags.workspaceId, workspaceId));
  const tagId = new Map(tagRows.map((t) => [t.name, t.id]));
  const created = await db.select({ id: timeEntries.id, startedAt: timeEntries.startedAt }).from(timeEntries).where(and(eq(timeEntries.workspaceId, workspaceId), eq(timeEntries.userId, userId)));
  const idByStart = new Map(created.map((e) => [e.startedAt.getTime(), e.id]));
  const links = rows.flatMap((r) => {
    const entryId = idByStart.get(r.startedAt.getTime());
    return entryId ? r.tagNames.map((n) => ({ timeEntryId: entryId, tagId: tagId.get(n)! })) : [];
  });
  for (let i = 0; i < links.length; i += 200) await db.insert(timeEntryTags).values(links.slice(i, i + 200)).onConflictDoNothing();
  return { ...plan, applied: true, skipped: false };
}
