import { z } from "zod";

const name = z.string().trim().min(1).max(120);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB color");

// Unknown keys (e.g. a smuggled `workspaceId`) are stripped by Zod; tenant ownership always comes from the session.

export const organizationInput = z.object({ name });
export const organizationPatch = z.object({ name: name.optional(), isArchived: z.boolean().optional() });

export const projectInput = z.object({ organizationId: z.uuid(), name, color: color.optional() });
export const projectPatch = z.object({
  organizationId: z.uuid().optional(),
  name: name.optional(),
  color: color.optional(),
  isArchived: z.boolean().optional(),
});

export const taskInput = z.object({ projectId: z.uuid(), name });
export const taskPatch = z.object({ name: name.optional(), isCompleted: z.boolean().optional() });

export const tagInput = z.object({ name, color: color.optional() });
export const tagPatch = z.object({ name: name.optional(), color: color.optional() });
