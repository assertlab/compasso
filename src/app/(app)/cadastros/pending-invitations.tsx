"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export const INVITATIONS_CHANGED = "compasso:invitations-changed";

type Invitation = { id: string; email: string; role?: string | null; expiresAt: Date | string };

/** Pending invitations of the active workspace: resend or cancel. Refreshes when the invite dialog sends a new one. */
export function PendingInvitations() {
  const [items, setItems] = useState<Invitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    authClient.organization.listInvitations().then(({ data }) => {
      if (!cancelled) setItems((data ?? []).filter((i) => i.status === "pending") as Invitation[]);
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => {
    const reload = () => setVersion((v) => v + 1);
    window.addEventListener(INVITATIONS_CHANGED, reload);
    return () => window.removeEventListener(INVITATIONS_CHANGED, reload);
  }, []);

  async function act(id: string, run: () => Promise<{ error?: unknown }>, failure: string) {
    setBusyId(id);
    setError(null);
    const { error: err } = await run();
    setBusyId(null);
    if (err) return setError(failure);
    setVersion((v) => v + 1);
  }

  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-lg border">
      <p className="border-b px-4 py-2 text-sm font-medium">Convites pendentes</p>
      <ul className="divide-y">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
            <span className="min-w-0 flex-1 truncate text-sm">{i.email}</span>
            <Badge variant="outline">{(i.role ?? "member").includes("admin") ? "Administrador" : "Membro"}</Badge>
            <span className="text-xs text-muted-foreground">expira {new Date(i.expiresAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId === i.id}
              onClick={() =>
                act(i.id, () => authClient.organization.inviteMember({ email: i.email, role: (i.role ?? "member").includes("admin") ? "admin" : "member", resend: true }), "Não foi possível reenviar o convite.")
              }
            >
              Reenviar
            </Button>
            <Button size="sm" variant="ghost" disabled={busyId === i.id} onClick={() => act(i.id, () => authClient.organization.cancelInvitation({ invitationId: i.id }), "Não foi possível cancelar o convite.")}>
              Cancelar
            </Button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="px-4 pb-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
