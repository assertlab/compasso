"use client";

import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveEntry } from "./actions";
import { DescriptionInput } from "./description-input";
import { EntityDialog } from "./cadastros/entity-dialog";
import { ProjectTaskFields } from "./project-task-fields";
import type { CatalogView, EntryView } from "./types";

const fieldError = (message?: string) => (message ? <p className="text-sm text-destructive">{message}</p> : null);

/** Manual entry (no `entry`) or edit of an existing one. Times are in the user's time zone. */
export function EntryDialog({ catalog, entry, today }: { catalog: CatalogView; entry?: EntryView; today: string }) {
  const running = entry !== undefined && entry.endedAt === null;
  return (
    <EntityDialog
      trigger={
        entry ? (
          <Button variant="ghost" size="icon" aria-label="Editar registro">
            <Pencil aria-hidden />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus aria-hidden />
            Lançar horas
          </Button>
        )
      }
      title={entry ? "Editar registro" : "Lançar horas"}
      description={entry ? undefined : "Adicione um período que você já trabalhou. Se o fim for antes do início, conta como o dia seguinte."}
      action={saveEntry}
      hidden={entry ? { id: entry.id } : undefined}
    >
      {(errors) => (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="entry-description">Descrição</Label>
            <DescriptionInput defaultValue={entry?.description} autoFocus />
          </div>
          <ProjectTaskFields catalog={catalog} defaultProjectId={entry?.projectId} defaultTaskId={entry?.taskId} errors={errors} />
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="date">Data</Label>
              <input id="date" name="date" type="date" required defaultValue={entry?.date ?? today} className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
              {fieldError(errors.date)}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="start">Início</Label>
              <input id="start" name="start" type="time" required defaultValue={entry?.startTime} className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
              {fieldError(errors.start)}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="end">Fim</Label>
              <input
                id="end"
                name="end"
                type="time"
                required={!running}
                disabled={running}
                defaultValue={entry?.endTime ?? undefined}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
              />
              {running ? <p className="text-xs text-muted-foreground">Em andamento</p> : fieldError(errors.end)}
            </div>
          </div>
          {catalog.tags.length > 0 && (
            <fieldset className="grid gap-1.5">
              <legend className="text-sm font-medium">Etiquetas</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {catalog.tags.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="tagIds" value={tag.id} defaultChecked={entry?.tagIds.includes(tag.id)} className="size-4 accent-primary" />
                    {tag.name}
                  </label>
                ))}
              </div>
              {fieldError(errors.tagIds)}
            </fieldset>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isBillable" defaultChecked={entry ? entry.isBillable : true} className="size-4 accent-primary" />
            Faturável
          </label>
        </>
      )}
    </EntityDialog>
  );
}
