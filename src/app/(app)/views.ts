import { entryDurationSeconds, localDateString, localTimeString } from "@/lib/time";
import type { Tenant } from "@/server/tenant";
import type { ReportRow } from "@/lib/report";
import type { TimeEntry } from "@/server/time-entries";
import type { CatalogView, EntryView } from "./types";

/** Everything the pickers and labels need, as plain serializable data. Archived items are included (existing entries may point to them). */
export async function loadCatalog(tenant: Tenant): Promise<CatalogView> {
  const [organizations, projects, tasks, tags, allowedProjectIds] = await Promise.all([
    tenant.organizations.list({ includeArchived: true }),
    tenant.projects.list({ includeArchived: true }),
    tenant.tasks.listAll(),
    tenant.tags.list(),
    tenant.projectMembers.myProjectIds(),
  ]);
  return {
    organizations: organizations.map((o) => ({ id: o.id, name: o.name })),
    projects: projects.map((p) => ({ id: p.id, name: p.name, color: p.color, organizationId: p.organizationId, isArchived: p.isArchived })),
    tasks: tasks.map((t) => ({ id: t.id, projectId: t.projectId, name: t.name, isCompleted: t.isCompleted })),
    tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    allowedProjectIds,
  };
}

export function toEntryView(e: TimeEntry, timezone: string): EntryView {
  return {
    id: e.id,
    description: e.description,
    projectId: e.projectId,
    taskId: e.taskId,
    tagIds: e.tagIds,
    isBillable: e.isBillable,
    startedAt: e.startedAt.toISOString(),
    endedAt: e.endedAt?.toISOString() ?? null,
    date: localDateString(e.startedAt, timezone),
    startTime: localTimeString(e.startedAt, timezone),
    endTime: e.endedAt ? localTimeString(e.endedAt, timezone) : null,
    endDate: e.endedAt ? localDateString(e.endedAt, timezone) : null,
    durationSeconds: e.endedAt ? entryDurationSeconds(e.startedAt, e.endedAt) : null,
  };
}

/** A finished report row as the edit dialog needs it. Tags and billing are not carried: corrections never touch them. */
export function reportRowToEntryView(r: ReportRow, timezone: string): EntryView {
  return {
    id: r.id,
    description: r.description,
    projectId: r.projectId,
    taskId: r.taskId,
    tagIds: [],
    isBillable: true,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt.toISOString(),
    date: localDateString(r.startedAt, timezone),
    startTime: localTimeString(r.startedAt, timezone),
    endTime: localTimeString(r.endedAt, timezone),
    endDate: localDateString(r.endedAt, timezone),
    durationSeconds: r.seconds,
  };
}
