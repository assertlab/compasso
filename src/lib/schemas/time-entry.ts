import { z } from "zod";

const description = z.string().trim().max(500, "Use até 500 caracteres");
const optionalId = z.uuid("Seleção inválida").nullable().optional();
const tagIds = z.array(z.uuid("Etiqueta inválida")).max(20, "No máximo 20 etiquetas");
const instant = (message: string) => z.coerce.date({ error: message });

// Unknown keys (workspaceId, userId...) are stripped; ownership always comes from the session.

export const startTimerInput = z.object({
  description: description.default(""),
  projectId: optionalId,
  taskId: optionalId,
  tagIds: tagIds.default([]),
  isBillable: z.boolean().default(true),
});

export const manualEntryInput = startTimerInput.extend({
  startedAt: instant("Informe o início"),
  endedAt: instant("Informe o fim"),
});

export const timeEntryPatch = z.object({
  description: description.optional(),
  projectId: optionalId,
  taskId: optionalId,
  tagIds: tagIds.optional(),
  isBillable: z.boolean().optional(),
  startedAt: instant("Informe o início").optional(),
  endedAt: instant("Informe o fim").optional(),
});
