"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { impliedEndDate } from "@/lib/entry-dates";
import { zonedMidnightUtc, zonedTimeToUtc } from "@/lib/time";
import { type ActionState, toActionState } from "@/server/action-state";
import { ValidationError } from "@/server/errors";
import { getTenant } from "@/server/get-tenant";
import type { Tenant } from "@/server/tenant";

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
};
const idOrNull = (fd: FormData, key: string) => str(fd, key) || null;

/** The form uses `start`/`end`; the domain uses `startedAt`/`endedAt`. */
function toFormErrors(state: ActionState): ActionState {
  if (!state.fieldErrors) return state;
  const { startedAt, endedAt, ...rest } = state.fieldErrors;
  return { ...state, fieldErrors: { ...rest, ...(startedAt && { start: startedAt }), ...(endedAt && { end: endedAt }) } };
}

async function mutate(work: (tenant: Tenant, timezone: string) => Promise<unknown>): Promise<ActionState> {
  const { tenant, ctx } = await getTenant(); // outside try: sign-in redirects must not be swallowed
  try {
    await work(tenant, ctx.timezone);
  } catch (error) {
    return toFormErrors(toActionState(error));
  }
  revalidatePath("/");
  return { ok: true };
}

export async function startTimerAction(formData: FormData): Promise<ActionState> {
  return mutate((t) =>
    t.timeEntries.startTimer({
      description: str(formData, "description"),
      projectId: idOrNull(formData, "projectId"),
      taskId: idOrNull(formData, "taskId"),
      isBillable: formData.get("isBillable") === "on",
    }),
  );
}

export async function resumeEntryAction(id: string): Promise<ActionState> {
  return mutate((t) => t.timeEntries.startFrom(id));
}

export async function stopTimerAction(): Promise<ActionState> {
  return mutate((t) => t.timeEntries.stopTimer());
}

/** Creates a manual entry, or edits one when `id` is present. An end time before the start means "next day". */
export async function saveEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = str(formData, "id");
  return mutate(async (t, timezone) => {
    const date = str(formData, "date");
    const start = str(formData, "start");
    const end = str(formData, "end");
    const endDate = str(formData, "endDate");
    const errors: Record<string, string> = {};
    if (!date) errors.date = "Informe a data";
    if (!start) errors.start = "Informe o início";
    if (!end && !id) errors.end = "Informe o fim";
    if (end && endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) errors.endDate = "Data inválida";
    if (Object.keys(errors).length) throw new ValidationError(errors);

    const toUtc = (d: string, time: string, field: string) => {
      try {
        return zonedTimeToUtc(d, time, timezone);
      } catch {
        throw new ValidationError({ [field]: "Horário inválido" });
      }
    };
    const startedAt = toUtc(date, start, "start");
    const endedAt = end ? toUtc(endDate || impliedEndDate(date, start, end), end, "end") : undefined;

    const data = {
      description: str(formData, "description"),
      projectId: idOrNull(formData, "projectId"),
      taskId: idOrNull(formData, "taskId"),
      tagIds: formData.getAll("tagIds").filter((v): v is string => typeof v === "string"),
      isBillable: formData.get("isBillable") === "on",
      startedAt,
    };
    if (id) return t.timeEntries.update(id, { ...data, endedAt });
    return t.timeEntries.createManual({ ...data, endedAt: endedAt! });
  });
}

const dragInput = z.object({ id: z.uuid(), shiftMinutes: z.number().min(-60 * 24 * 7).max(60 * 24 * 7) });
const resizeInput = z.object({
  id: z.uuid(),
  edge: z.enum(["start", "end"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minute: z.number().min(0).max(1440),
});

/** Calendar drag: shift a finished entry by a number of minutes (negative = earlier). */
export async function moveEntryAction(input: z.input<typeof dragInput>): Promise<ActionState> {
  return mutate(async (t) => {
    const { id, shiftMinutes } = dragInput.parse(input);
    return t.timeEntries.move(id, Math.round(shiftMinutes));
  });
}

/** Calendar drag: move one edge to `minute` (minutes since local midnight of `date`, 0-1440). */
export async function resizeEntryAction(input: z.input<typeof resizeInput>): Promise<ActionState> {
  return mutate(async (t, timezone) => {
    const { id, edge, date, minute } = resizeInput.parse(input);
    const at = new Date(zonedMidnightUtc(date, timezone).getTime() + Math.round(minute) * 60_000);
    return t.timeEntries.resize(id, edge, at);
  });
}

export async function deleteEntryAction(id: string): Promise<ActionState> {
  return mutate((t) => t.timeEntries.softDelete(id));
}

export async function restoreEntryAction(id: string): Promise<ActionState> {
  return mutate((t) => t.timeEntries.restore(id));
}

/** Autocomplete for the description field: the caller's own recent descriptions. */
export async function searchDescriptions(prefix: string): Promise<string[]> {
  const { tenant } = await getTenant();
  return tenant.timeEntries.recentDescriptions(prefix.slice(0, 100));
}
