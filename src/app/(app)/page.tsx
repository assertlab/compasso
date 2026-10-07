import { Suspense } from "react";
import { weekStart } from "@/lib/entry-groups";
import { addDays, entryDurationSeconds, localDateString, localTimeString, zonedDayRange, zonedMidnightUtc } from "@/lib/time";
import { getTenant } from "@/server/get-tenant";
import { EntryDialog } from "./entry-dialog";
import { EntryList } from "./entry-list";
import { TimerBar } from "./timer-bar";
import type { CatalogView, EntryView } from "./types";

const DEFAULT_WEEKS = 2;
const MAX_WEEKS = 26;

/** `?semanas=N`: how many weeks of history the list shows (current week included). */
function parseWeeks(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) ? Math.min(Math.max(n, 1), MAX_WEEKS) : DEFAULT_WEEKS;
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" aria-hidden />}>
      <Today searchParams={searchParams} />
    </Suspense>
  );
}

async function Today({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const weeks = parseWeeks((await searchParams).semanas);
  const { ctx, tenant } = await getTenant();
  const tz = ctx.timezone;
  const now = new Date();
  const today = localDateString(now, tz);
  const currentWeek = weekStart(today);
  const range = {
    from: zonedMidnightUtc(addDays(currentWeek, -7 * (weeks - 1)), tz),
    to: zonedDayRange(today, tz).to,
  };

  const [organizations, projects, tasks, tags, running, entries] = await Promise.all([
    tenant.organizations.list({ includeArchived: true }),
    tenant.projects.list({ includeArchived: true }),
    tenant.tasks.listAll(),
    tenant.tags.list(),
    tenant.timeEntries.runningTimer(),
    tenant.timeEntries.list(range),
  ]);

  const catalog: CatalogView = {
    organizations: organizations.map((o) => ({ id: o.id, name: o.name })),
    projects: projects.map((p) => ({ id: p.id, name: p.name, color: p.color, organizationId: p.organizationId, isArchived: p.isArchived })),
    tasks: tasks.map((t) => ({ id: t.id, projectId: t.projectId, name: t.name, isCompleted: t.isCompleted })),
    tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
  };

  const views: EntryView[] = entries.map((e) => ({
    id: e.id,
    description: e.description,
    projectId: e.projectId,
    taskId: e.taskId,
    tagIds: e.tagIds,
    isBillable: e.isBillable,
    startedAt: e.startedAt.toISOString(),
    endedAt: e.endedAt?.toISOString() ?? null,
    date: localDateString(e.startedAt, tz),
    startTime: localTimeString(e.startedAt, tz),
    endTime: e.endedAt ? localTimeString(e.endedAt, tz) : null,
    durationSeconds: e.endedAt ? entryDurationSeconds(e.startedAt, e.endedAt) : null,
  }));

  const current = running.here;
  const currentProject = current ? catalog.projects.find((p) => p.id === current.projectId) : undefined;

  return (
    <section className="flex flex-col gap-6">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{ctx.workspaceName}</p>
      <TimerBar
        catalog={catalog}
        running={current ? { startedAt: current.startedAt.toISOString(), description: current.description, projectLabel: currentProject?.name ?? null } : null}
        elsewhere={running.elsewhere ? { workspaceName: running.elsewhere.workspaceName, startedAt: running.elsewhere.startedAt.toISOString() } : null}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Registros</h1>
        <EntryDialog catalog={catalog} today={today} />
      </div>
      <EntryList entries={views} catalog={catalog} today={today} currentWeek={currentWeek} loadMoreHref={weeks < MAX_WEEKS ? `/?semanas=${weeks + 1}` : null} />
    </section>
  );
}
