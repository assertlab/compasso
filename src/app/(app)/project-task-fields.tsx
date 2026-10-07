"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CatalogView } from "./types";

export const selectClass =
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive";

/**
 * Project and task pickers (native selects: fast, accessible, and an empty option means "no project").
 * Archived projects and completed tasks are offered only when already selected.
 */
export function ProjectTaskFields({
  catalog,
  defaultProjectId,
  defaultTaskId,
  errors = {},
  className,
}: {
  catalog: CatalogView;
  defaultProjectId?: string | null;
  defaultTaskId?: string | null;
  errors?: Record<string, string>;
  className?: string;
}) {
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [taskId, setTaskId] = useState(defaultTaskId ?? "");

  const projects = catalog.projects.filter((p) => !p.isArchived || p.id === defaultProjectId);
  const tasks = catalog.tasks.filter((t) => t.projectId === projectId && (!t.isCompleted || t.id === defaultTaskId));

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      <div className="grid gap-1.5">
        <select
          name="projectId"
          aria-label="Projeto"
          className={selectClass}
          value={projectId}
          aria-invalid={errors.projectId ? true : undefined}
          onChange={(e) => {
            setProjectId(e.target.value);
            setTaskId("");
          }}
        >
          <option value="">Sem projeto</option>
          {catalog.organizations.map((org) => {
            const items = projects.filter((p) => p.organizationId === org.id);
            return items.length === 0 ? null : (
              <optgroup key={org.id} label={org.name}>
                {items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.isArchived ? " (arquivado)" : ""}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        {errors.projectId && <p className="text-sm text-destructive">{errors.projectId}</p>}
      </div>
      <div className="grid gap-1.5">
        <select
          name="taskId"
          aria-label="Tarefa"
          className={selectClass}
          value={taskId}
          disabled={!projectId || tasks.length === 0}
          aria-invalid={errors.taskId ? true : undefined}
          onChange={(e) => setTaskId(e.target.value)}
        >
          <option value="">Sem tarefa</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.isCompleted ? " (concluída)" : ""}
            </option>
          ))}
        </select>
        {errors.taskId && <p className="text-sm text-destructive">{errors.taskId}</p>}
      </div>
    </div>
  );
}
