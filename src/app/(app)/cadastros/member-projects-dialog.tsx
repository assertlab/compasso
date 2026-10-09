"use client";

import { FolderCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setMemberProjects } from "./actions";
import { EntityDialog } from "./entity-dialog";

export type AssignableProject = { id: string; name: string; color: string; clientName: string };

/** Ticks the active projects a member takes part in (admins never need this: they use every project). */
export function MemberProjectsDialog({
  userId,
  memberName,
  projects,
  selectedIds,
  highlight,
}: {
  userId: string;
  memberName: string;
  projects: AssignableProject[];
  selectedIds: string[];
  /** The member has no project yet: make the way out obvious. */
  highlight: boolean;
}) {
  // Plain loop instead of Map.groupBy: older iOS versions (the installed PWA) do not have it.
  const byClient = new Map<string, AssignableProject[]>();
  for (const project of projects) byClient.set(project.clientName, [...(byClient.get(project.clientName) ?? []), project]);
  return (
    <EntityDialog
      title={`Projetos de ${memberName}`}
      description="Marque os projetos em que a pessoa pode lançar horas. Os registros já feitos não mudam."
      action={setMemberProjects}
      hidden={{ userId }}
      trigger={
        <Button type="button" size="sm" variant={highlight ? "default" : "outline"}>
          <FolderCog aria-hidden />
          Projetos
        </Button>
      }
    >
      {(errors) => (
        <div className="grid max-h-80 gap-3 overflow-y-auto pr-1">
          {projects.length === 0 && <p className="text-sm text-muted-foreground">Não há projetos ativos. Crie um projeto primeiro.</p>}
          {[...byClient].map(([client, list]) => (
            <fieldset key={client} className="grid gap-1.5">
              <legend className="mb-1 text-xs font-medium text-muted-foreground">{client}</legend>
              {list.map((project) => (
                <label key={project.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" name="projectId" value={project.id} defaultChecked={selectedIds.includes(project.id)} className="size-4 accent-primary" />
                  <span className="size-2 rounded-full" style={{ backgroundColor: project.color }} aria-hidden />
                  {project.name}
                </label>
              ))}
            </fieldset>
          ))}
          {errors.userId && <p className="text-sm text-destructive">{errors.userId}</p>}
        </div>
      )}
    </EntityDialog>
  );
}
