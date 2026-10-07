"use server";

import { revalidatePath } from "next/cache";
import { type ActionState, toActionState } from "@/server/action-state";
import { getTenant } from "@/server/get-tenant";
import type { Tenant } from "@/server/tenant";

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/**
 * Runs a catalog mutation as the signed-in workspace member. The session is
 * resolved outside the try/catch so sign-in redirects are not swallowed.
 */
async function mutate(work: (tenant: Tenant) => Promise<unknown>): Promise<ActionState> {
  const { tenant } = await getTenant();
  try {
    await work(tenant);
  } catch (error) {
    return toActionState(error);
  }
  revalidatePath("/cadastros", "layout");
  return { ok: true };
}

export async function saveOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = text(formData, "id");
  const name = text(formData, "name");
  return mutate((t) => (id ? t.organizations.update(id, { name }) : t.organizations.create({ name })));
}

export async function setOrganizationArchived(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return mutate((t) => t.organizations.update(text(formData, "id"), { isArchived: text(formData, "archived") === "true" }));
}

export async function saveProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = text(formData, "id");
  const data = { organizationId: text(formData, "organizationId"), name: text(formData, "name"), color: text(formData, "color") || undefined };
  return mutate((t) => (id ? t.projects.update(id, data) : t.projects.create(data)));
}

export async function setProjectArchived(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return mutate((t) => t.projects.update(text(formData, "id"), { isArchived: text(formData, "archived") === "true" }));
}

export async function saveTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = text(formData, "id");
  const name = text(formData, "name");
  return mutate((t) => (id ? t.tasks.update(id, { name }) : t.tasks.create({ projectId: text(formData, "projectId"), name })));
}

export async function setTaskCompleted(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return mutate((t) => t.tasks.update(text(formData, "id"), { isCompleted: text(formData, "completed") === "true" }));
}

export async function saveTag(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = text(formData, "id");
  const data = { name: text(formData, "name"), color: text(formData, "color") || undefined };
  return mutate((t) => (id ? t.tags.update(id, data) : t.tags.create(data)));
}

export async function addProjectParticipant(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return mutate((t) => t.projectMembers.add(text(formData, "projectId"), text(formData, "userId")));
}

export async function removeProjectParticipant(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return mutate((t) => t.projectMembers.remove(text(formData, "projectId"), text(formData, "userId")));
}
