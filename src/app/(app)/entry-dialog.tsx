"use client";

import { Pencil, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveEntry } from "./actions";
import { DescriptionInput } from "./description-input";
import { EntityDialog } from "./cadastros/entity-dialog";
import { EntryTimeFields } from "./entry-time-fields";
import { ProjectTaskFields } from "./project-task-fields";
import type { CatalogView, EntryView } from "./types";

const fieldError = (message?: string) =>
  message ? <p className="text-sm text-destructive">{message}</p> : null;

export type EntryPrefill = { date: string; start: string; end: string };

/**
 * Manual entry (no `entry`) or edit of an existing one. Times are in the user's time zone.
 * `trigger` replaces the default button; with `open`/`onOpenChange` the parent controls it (calendar drag).
 */
export function EntryDialog({
  catalog,
  entry,
  today,
  trigger,
  open,
  onOpenChange,
  prefill,
  correctionOf,
}: {
  catalog: CatalogView;
  entry?: EntryView;
  today: string;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  prefill?: EntryPrefill;
  /** Admin fixing someone else's entry (the person's name): the change is recorded; tags and billing stay as they are. */
  correctionOf?: string;
}) {
  const running = entry !== undefined && entry.endedAt === null;
  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        trigger !== undefined ? (
          trigger
        ) : open !== undefined ? undefined : entry ? (
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
      title={
        correctionOf
          ? "Corrigir registro"
          : entry
            ? "Editar registro"
            : "Lançar horas"
      }
      description={
        correctionOf
          ? `Registro de ${correctionOf}. A correção fica registrada: quem alterou, quando e o que mudou.`
          : entry
            ? undefined
            : "Adicione um período que você já trabalhou. A data de término muda para o dia seguinte quando o fim é antes do início."
      }
      action={saveEntry}
      hidden={
        entry
          ? { id: entry.id, ...(correctionOf ? { correction: "1" } : {}) }
          : undefined
      }
    >
      {(errors) => (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="entry-description">Descrição</Label>
            <DescriptionInput defaultValue={entry?.description} autoFocus />
          </div>
          <ProjectTaskFields
            catalog={catalog}
            defaultProjectId={entry?.projectId}
            defaultTaskId={entry?.taskId}
            errors={errors}
          />
          <EntryTimeFields
            defaults={{
              date: entry?.date ?? prefill?.date ?? today,
              start: entry?.startTime ?? prefill?.start ?? "",
              end: entry?.endTime ?? prefill?.end ?? "",
              endDate: entry?.endDate,
              isExisting: entry !== undefined,
            }}
            running={running}
            errors={errors}
          />
          {!correctionOf && catalog.tags.length > 0 && (
            <fieldset className="grid gap-1.5">
              <legend className="text-sm font-medium">Etiquetas</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {catalog.tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="tagIds"
                      value={tag.id}
                      defaultChecked={entry?.tagIds.includes(tag.id)}
                      className="size-4 accent-primary"
                    />
                    {tag.name}
                  </label>
                ))}
              </div>
              {fieldError(errors.tagIds)}
            </fieldset>
          )}
          {!correctionOf && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isBillable"
                defaultChecked={entry ? entry.isBillable : true}
                className="size-4 accent-primary"
              />
              Faturável
            </label>
          )}
        </>
      )}
    </EntityDialog>
  );
}
