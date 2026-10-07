"use client";

import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { organizations, projects, tags, tasks } from "@/db/schema";
import { saveOrganization, saveProject, saveTag, saveTask } from "./actions";
import { ColorField, EntityDialog, TextField } from "./entity-dialog";

type Organization = typeof organizations.$inferSelect;
type Project = typeof projects.$inferSelect;
type Task = typeof tasks.$inferSelect;
type Tag = typeof tags.$inferSelect;

const editTrigger = (name: string) => (
  <Button variant="ghost" size="icon" aria-label={`Editar ${name}`}>
    <Pencil aria-hidden />
  </Button>
);

const createTrigger = (label: string) => (
  <Button size="sm">
    <Plus aria-hidden />
    {label}
  </Button>
);

export function OrganizationDialog({ organization }: { organization?: Organization }) {
  return (
    <EntityDialog
      trigger={organization ? editTrigger(organization.name) : createTrigger("Nova organização")}
      title={organization ? "Editar organização" : "Nova organização"}
      description="Sua empresa ou um cliente. Agrupa projetos nos relatórios."
      action={saveOrganization}
      hidden={organization ? { id: organization.id } : undefined}
    >
      {(errors) => <TextField name="name" label="Nome" defaultValue={organization?.name} error={errors.name} autoFocus />}
    </EntityDialog>
  );
}

export function ProjectDialog({ project, organizations }: { project?: Project; organizations: Organization[] }) {
  return (
    <EntityDialog
      trigger={project ? editTrigger(project.name) : createTrigger("Novo projeto")}
      title={project ? "Editar projeto" : "Novo projeto"}
      action={saveProject}
      hidden={project ? { id: project.id } : undefined}
    >
      {(errors) => (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="organizationId">Organização</Label>
            <Select name="organizationId" defaultValue={project?.organizationId} required>
              <SelectTrigger id="organizationId" aria-invalid={errors.organizationId ? true : undefined}>
                <SelectValue placeholder="Escolha uma organização" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.organizationId && <p className="text-sm text-destructive">{errors.organizationId}</p>}
          </div>
          <TextField name="name" label="Nome" defaultValue={project?.name} error={errors.name} autoFocus />
          <ColorField defaultValue={project?.color ?? "#3B82F6"} error={errors.color} />
        </>
      )}
    </EntityDialog>
  );
}

export function TaskDialog({ projectId, task }: { projectId: string; task?: Task }) {
  return (
    <EntityDialog
      trigger={task ? editTrigger(task.name) : createTrigger("Nova tarefa")}
      title={task ? "Editar tarefa" : "Nova tarefa"}
      action={saveTask}
      hidden={task ? { id: task.id } : { projectId }}
    >
      {(errors) => <TextField name="name" label="Nome" defaultValue={task?.name} error={errors.name} autoFocus />}
    </EntityDialog>
  );
}

export function TagDialog({ tag }: { tag?: Tag }) {
  return (
    <EntityDialog
      trigger={tag ? editTrigger(tag.name) : createTrigger("Nova tag")}
      title={tag ? "Editar tag" : "Nova tag"}
      action={saveTag}
      hidden={tag ? { id: tag.id } : undefined}
    >
      {(errors) => (
        <>
          <TextField name="name" label="Nome" defaultValue={tag?.name} error={errors.name} autoFocus />
          <ColorField defaultValue={tag?.color ?? "#6B7280"} error={errors.color} />
        </>
      )}
    </EntityDialog>
  );
}
