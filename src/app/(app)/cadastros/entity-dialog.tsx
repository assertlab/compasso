"use client";

import { type ReactNode, useActionState, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/server/action-state";

export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const idle: ActionState = { ok: false };

function HiddenFields({ fields }: { fields?: Record<string, string> }) {
  return Object.entries(fields ?? {}).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />);
}

export function TextField({
  name,
  label,
  error,
  defaultValue,
  autoFocus,
}: {
  name: string;
  label: string;
  error?: string;
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function ColorField({ name = "color", label = "Cor", defaultValue, error }: { name?: string; label?: string; defaultValue: string; error?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <input
        id={name}
        name={name}
        type="color"
        defaultValue={defaultValue}
        className="h-9 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function DialogForm({
  action,
  hidden,
  submitLabel,
  onDone,
  children,
}: {
  action: FormAction;
  hidden?: Record<string, string>;
  submitLabel: string;
  onDone: () => void;
  children: (errors: Record<string, string>) => ReactNode;
}) {
  // Lives inside DialogContent, so it remounts (and forgets old errors) every time the dialog opens.
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const next = await action(prev, formData);
    if (next.ok) onDone();
    return next;
  }, idle);

  return (
    <form action={formAction} className="grid gap-4">
      <HiddenFields fields={hidden} />
      {children(state.fieldErrors ?? {})}
      {state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** A trigger button that opens a form dialog backed by a Server Action. Closes itself on success. */
export function EntityDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  action,
  hidden,
  submitLabel = "Salvar",
  children,
}: {
  /** Omit when the dialog is opened from elsewhere (controlled with `open`/`onOpenChange`). */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  action: FormAction;
  hidden?: Record<string, string>;
  submitLabel?: string;
  children: (errors: Record<string, string>) => ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent {...(description ? {} : { "aria-describedby": undefined })}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogForm action={action} hidden={hidden} submitLabel={submitLabel} onDone={() => setOpen(false)}>
          {children}
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}

/** One-click mutation (archive, complete, ...) with its own error line. */
export function ActionButton({
  action,
  fields,
  variant = "outline",
  size = "sm",
  children,
}: {
  action: FormAction;
  fields: Record<string, string>;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, idle);
  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <HiddenFields fields={fields} />
      <Button type="submit" variant={variant} size={size} disabled={pending}>
        {children}
      </Button>
      {state.message && (
        <p role="alert" className="max-w-48 text-right text-xs text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}
