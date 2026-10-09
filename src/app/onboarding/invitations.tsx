"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

type Invitation = { id: string; organizationName?: string; role?: string | null };

/** Pending invitations addressed to the signed-in e-mail (the server only lists those). */
export function Invitations({ onAccepted }: { onAccepted: (organizationId: string) => void }) {
  const [items, setItems] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authClient.organization.listUserInvitations().then(({ data }) => {
      if (!cancelled && data) setItems(data.filter((i) => i.status === "pending") as Invitation[]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0 && !error) return null;

  async function accept(id: string) {
    setError(null);
    const { data, error: err } = await authClient.organization.acceptInvitation({ invitationId: id });
    if (err || !data) return setError("Não foi possível aceitar o convite. Ele pode ter expirado.");
    onAccepted(data.invitation.organizationId);
  }

  async function reject(id: string) {
    setError(null);
    const { error: err } = await authClient.organization.rejectInvitation({ invitationId: id });
    if (err) return setError("Não foi possível recusar o convite.");
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Convites para você</CardTitle>
        <CardDescription>Aceite para entrar no workspace.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-medium">{i.organizationName ?? "Workspace"}</span>
            <span className="flex shrink-0 gap-2">
              <Button size="sm" onClick={() => accept(i.id)}>Aceitar</Button>
              <Button size="sm" variant="ghost" onClick={() => reject(i.id)}>Recusar</Button>
            </span>
          </div>
        ))}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
