"use server";

import { revalidatePath } from "next/cache";
import { addDays, zonedTimeToUtc } from "@/lib/time";
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
    const errors: Record<string, string> = {};
    if (!date) errors.date = "Informe a data";
    if (!start) errors.start = "Informe o início";
    if (!end && !id) errors.end = "Informe o fim";
    if (Object.keys(errors).length) throw new ValidationError(errors);

    const toUtc = (d: string, time: string, field: string) => {
      try {
        return zonedTimeToUtc(d, time, timezone);
      } catch {
        throw new ValidationError({ [field]: "Horário inválido" });
      }
    };
    const startedAt = toUtc(date, start, "start");
    const endedAt = end ? toUtc(end <= start ? addDays(date, 1) : date, end, "end") : undefined;

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
