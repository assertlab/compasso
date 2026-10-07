import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, max, sql } from "drizzle-orm";
import type { z } from "zod";
import { tags, timeEntries, timeEntryTags, workspaces } from "@/db/schema";
import { checkRange, rangeMessages } from "@/lib/time-entry-rules";
import { manualEntryInput, startTimerInput, timeEntryPatch } from "@/lib/schemas/time-entry";
import { isUniqueViolation } from "./db-errors";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import type { TenantContext, TenantDb } from "./tenant";

type Project = { id: string; isArchived: boolean };
type Task = { id: string; projectId: string; isCompleted: boolean };
type Entry = typeof timeEntries.$inferSelect;
export type TimeEntry = Entry & { tagIds: string[] };

type Deps = {
  now: () => Date;
  getProject: (id: string) => Promise<Project>;
  getTask: (id: string) => Promise<Task>;
};

export type RunningTimer = {
  /** The caller's running timer in the current workspace. */
  here: TimeEntry | null;
  /** The caller's running timer in another workspace (a user has at most one, globally). */
  elsewhere: { workspaceName: string; startedAt: Date } | null;
};

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Time entries of the signed-in user inside the current workspace (ADR-029).
 *  - Entries are always the caller's own: even admins edit only their own hours; admins may *read* others' (list).
 *  - Deletion is logical (`deleted_at`) and reversible; a deleted entry frees the single running-timer slot.
 *  - Project/task/tags are verified to belong to the workspace; archived projects and completed tasks
 *    cannot be newly assigned (existing assignments are kept).
 *  - neon-http has no interactive transactions, so multi-statement operations (stop + start, tag rewrite)
 *    are sequential, not atomic. The unique index is the final guard against two running timers.
 */
export function createTimeEntries(db: TenantDb, ctx: TenantContext, deps: Deps) {
  const ws = ctx.workspaceId;
  const own = (extra?: ReturnType<typeof and>) =>
    and(eq(timeEntries.workspaceId, ws), eq(timeEntries.userId, ctx.userId), isNull(timeEntries.deletedAt), extra);

  async function withTags(rows: Entry[]): Promise<TimeEntry[]> {
    if (rows.length === 0) return [];
    const links = await db
      .select({ timeEntryId: timeEntryTags.timeEntryId, tagId: timeEntryTags.tagId })
      .from(timeEntryTags)
      .where(inArray(timeEntryTags.timeEntryId, rows.map((r) => r.id)));
    const byEntry = new Map<string, string[]>();
    for (const l of links) byEntry.set(l.timeEntryId, [...(byEntry.get(l.timeEntryId) ?? []), l.tagId]);
    return rows.map((r) => ({ ...r, tagIds: byEntry.get(r.id) ?? [] }));
  }

  async function getOwn(id: string): Promise<Entry> {
    const [row] = await db.select().from(timeEntries).where(own(eq(timeEntries.id, id)));
    if (!row) throw new NotFoundError("Time entry");
    return row;
  }

  async function assertTags(tagIds: string[]) {
    const unique = [...new Set(tagIds)];
    if (unique.length === 0) return unique;
    const found = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.workspaceId, ws), inArray(tags.id, unique)));
    if (found.length !== unique.length) throw new NotFoundError("Tag");
    return unique;
  }

  /** Validates a (project, task) pair. `current` holds what the entry already has, so unchanged links are not re-judged. */
  async function assertRefs(
    projectId: string | null,
    taskId: string | null,
    current: { projectId: string | null; taskId: string | null } = { projectId: null, taskId: null },
  ) {
    if (projectId && projectId !== current.projectId) {
      const project = await deps.getProject(projectId);
      if (project.isArchived) throw new ValidationError({ projectId: "Este projeto está arquivado." });
    }
    if (taskId) {
      if (!projectId) throw new ValidationError({ taskId: "Escolha o projeto da tarefa." });
      const task = await deps.getTask(taskId);
      if (task.projectId !== projectId) throw new ValidationError({ taskId: "A tarefa não pertence ao projeto." });
      if (task.isCompleted && taskId !== current.taskId) throw new ValidationError({ taskId: "Esta tarefa já foi concluída." });
    }
  }

  function assertRange(startedAt: Date, endedAt: Date | null) {
    const problem = checkRange(startedAt, endedAt, deps.now());
    if (!problem) return;
    const startInFuture = startedAt.getTime() > deps.now().getTime();
    const field = problem === "in_future" && startInFuture ? "startedAt" : "endedAt";
    throw new ValidationError({ [field]: rangeMessages[problem] });
  }

  async function setTags(entryId: string, tagIds: string[]) {
    await db.delete(timeEntryTags).where(eq(timeEntryTags.timeEntryId, entryId));
    if (tagIds.length > 0) await db.insert(timeEntryTags).values(tagIds.map((tagId) => ({ timeEntryId: entryId, tagId })));
  }

  async function runningTimer(): Promise<RunningTimer> {
    // Deliberately not filtered by workspace: it is the caller's own timer, wherever it runs.
    const [row] = await db
      .select({ entry: timeEntries, workspaceName: workspaces.name })
      .from(timeEntries)
      .innerJoin(workspaces, eq(workspaces.id, timeEntries.workspaceId))
      .where(and(eq(timeEntries.userId, ctx.userId), isNull(timeEntries.endedAt), isNull(timeEntries.deletedAt)));
    if (!row) return { here: null, elsewhere: null };
    if (row.entry.workspaceId !== ws) {
      return { here: null, elsewhere: { workspaceName: row.workspaceName, startedAt: row.entry.startedAt } };
    }
    const [entry] = await withTags([row.entry]);
    return { here: entry, elsewhere: null };
  }

  /** Ends `entry` now; never before its own start (the DB requires end > start). */
  async function stopEntry(entry: Entry): Promise<Entry> {
    const endedAt = new Date(Math.max(deps.now().getTime(), entry.startedAt.getTime() + 1));
    const [row] = await db
      .update(timeEntries)
      .set({ endedAt })
      .where(own(and(eq(timeEntries.id, entry.id), isNull(timeEntries.endedAt))))
      .returning();
    if (!row) throw new NotFoundError("Running timer");
    return row;
  }

  return {
    runningTimer,

    /** Starts a timer now. A timer already running here is stopped first; one running in another workspace blocks. */
    async startTimer(input: z.input<typeof startTimerInput> = {}): Promise<TimeEntry> {
      const data = startTimerInput.parse(input);
      const projectId = data.projectId ?? null;
      const taskId = data.taskId ?? null;
      await assertRefs(projectId, taskId);
      const tagIds = await assertTags(data.tagIds);

      const running = await runningTimer();
      if (running.elsewhere) {
        throw new ConflictError(`Já existe um timer rodando em "${running.elsewhere.workspaceName}". Pare-o antes de iniciar outro.`);
      }
      if (running.here) await stopEntry(running.here);

      try {
        const [row] = await db
          .insert(timeEntries)
          .values({
            workspaceId: ws,
            userId: ctx.userId,
            projectId,
            taskId,
            description: data.description,
            isBillable: data.isBillable,
            startedAt: deps.now(),
            timezone: ctx.timezone,
          })
          .returning();
        await setTags(row.id, tagIds);
        return { ...row, tagIds };
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictError("Já existe um timer rodando. Atualize a página.");
        throw error;
      }
    },

    async stopTimer(): Promise<TimeEntry> {
      const { here } = await runningTimer();
      if (!here) throw new NotFoundError("Running timer");
      const row = await stopEntry(here);
      return { ...row, tagIds: here.tagIds };
    },

    async createManual(input: z.input<typeof manualEntryInput>): Promise<TimeEntry> {
      const data = manualEntryInput.parse(input);
      assertRange(data.startedAt, data.endedAt);
      const projectId = data.projectId ?? null;
      const taskId = data.taskId ?? null;
      await assertRefs(projectId, taskId);
      const tagIds = await assertTags(data.tagIds);
      const [row] = await db
        .insert(timeEntries)
        .values({
          workspaceId: ws,
          userId: ctx.userId,
          projectId,
          taskId,
          description: data.description,
          isBillable: data.isBillable,
          startedAt: data.startedAt,
          endedAt: data.endedAt,
          timezone: ctx.timezone,
        })
        .returning();
      await setTags(row.id, tagIds);
      return { ...row, tagIds };
    },

    /** Edits the caller's own entry. Changing the project clears the task unless a new one is given. */
    async update(id: string, patch: z.input<typeof timeEntryPatch>): Promise<TimeEntry> {
      const data = timeEntryPatch.parse(patch);
      const current = await getOwn(id);

      const startedAt = data.startedAt ?? current.startedAt;
      const endedAt = data.endedAt ?? current.endedAt;
      if (data.startedAt || data.endedAt) assertRange(startedAt, endedAt);

      const projectId = data.projectId !== undefined ? data.projectId : current.projectId;
      const projectChanged = data.projectId !== undefined && data.projectId !== current.projectId;
      const taskId = data.taskId !== undefined ? data.taskId : projectChanged ? null : current.taskId;
      if (data.projectId !== undefined || data.taskId !== undefined) await assertRefs(projectId, taskId, current);
      const tagIds = data.tagIds ? await assertTags(data.tagIds) : null;

      const [row] = await db
        .update(timeEntries)
        .set({
          description: data.description,
          isBillable: data.isBillable,
          startedAt: data.startedAt,
          endedAt: data.endedAt,
          projectId,
          taskId,
        })
        .where(own(eq(timeEntries.id, id)))
        .returning();
      if (!row) throw new NotFoundError("Time entry");
      if (tagIds) await setTags(id, tagIds);
      const [entry] = await withTags([row]);
      return entry;
    },

    async softDelete(id: string): Promise<void> {
      const [row] = await db
        .update(timeEntries)
        .set({ deletedAt: deps.now() })
        .where(own(eq(timeEntries.id, id)))
        .returning({ id: timeEntries.id });
      if (!row) throw new NotFoundError("Time entry");
    },

    /** Undo for `softDelete`. Fails with ConflictError if it was the running timer and another one has started since. */
    async restore(id: string): Promise<TimeEntry> {
      try {
        const [row] = await db
          .update(timeEntries)
          .set({ deletedAt: null })
          .where(
            and(
              eq(timeEntries.id, id),
              eq(timeEntries.workspaceId, ws),
              eq(timeEntries.userId, ctx.userId),
              isNotNull(timeEntries.deletedAt),
            ),
          )
          .returning();
        if (!row) throw new NotFoundError("Time entry");
        const [entry] = await withTags([row]);
        return entry;
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictError("Outro timer já está rodando; não é possível restaurar este.");
        throw error;
      }
    },

    /**
     * Entries starting in [from, to). Members see only their own hours (ADR-029); admins default to their
     * own and may ask for everyone (`"all"`) or one member. Never includes deleted entries.
     */
    async list({ from, to, userId }: { from: Date; to: Date; userId?: string | "all" }): Promise<TimeEntry[]> {
      const target = userId ?? ctx.userId;
      if (target !== ctx.userId && ctx.role !== "admin") throw new ForbiddenError("Members can only see their own hours");
      const rows = await db
        .select()
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.workspaceId, ws),
            isNull(timeEntries.deletedAt),
            target === "all" ? undefined : eq(timeEntries.userId, target),
            gte(timeEntries.startedAt, from),
            lt(timeEntries.startedAt, to),
          ),
        )
        .orderBy(desc(timeEntries.startedAt));
      return withTags(rows);
    },

    /** The caller's most recent distinct descriptions starting with `prefix` (autocomplete). */
    async recentDescriptions(prefix: string, limit = 8): Promise<string[]> {
      const p = prefix.trim();
      const rows = await db
        .select({ description: timeEntries.description, last: max(timeEntries.startedAt) })
        .from(timeEntries)
        .where(own(and(sql`${timeEntries.description} <> ''`, p ? ilike(timeEntries.description, `${likeEscape(p)}%`) : undefined)))
        .groupBy(timeEntries.description)
        .orderBy(desc(max(timeEntries.startedAt)))
        .limit(Math.min(Math.max(limit, 1), 20));
      return rows.map((r) => r.description);
    },
  };
}
