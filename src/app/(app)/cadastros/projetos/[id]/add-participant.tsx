"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/server/action-state";
import { addProjectParticipant } from "../../actions";
import { selectClass } from "../../../project-task-fields";

const idle: ActionState = { ok: false };

/** Picks one of the workspace members who is not yet in the project and adds them. */
export function AddParticipant({ projectId, candidates }: { projectId: string; candidates: { userId: string; name: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addProjectParticipant, idle);
  if (candidates.length === 0) return <p className="text-sm text-muted-foreground">Todos os membros do laboratório já participam deste projeto.</p>;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <select name="userId" aria-label="Adicionar participante" required defaultValue="" className={`${selectClass} max-w-64`}>
        <option value="" disabled>
          Adicionar participante…
        </option>
        {candidates.map((c) => (
          <option key={c.userId} value={c.userId}>
            {c.name}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        Adicionar
      </Button>
      {state.message && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}
