"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

/** Explicit click (no side effect on GET). The server only accepts it when the invitation is for the signed-in e-mail. */
export function AcceptInvitation({ invitationId, email }: { invitationId: string; email: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    setError(null);
    const { data, error: err } = await authClient.organization.acceptInvitation({ invitationId });
    if (err || !data) {
      setBusy(false);
      return setError(`Não foi possível aceitar. O convite precisa ser para ${email}, e pode ter expirado ou sido cancelado.`);
    }
    await authClient.organization.setActive({ organizationId: data.invitation.organizationId });
    router.replace("/");
    router.refresh();
  }

  return (
    <Card className="w-[25rem] max-w-full">
      <CardHeader>
        <CardTitle>Você foi convidado</CardTitle>
        <CardDescription>Entrar no workspace como {email}.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Button onClick={accept} disabled={busy}>{busy ? "Entrando…" : "Aceitar convite"}</Button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button variant="ghost" size="sm" onClick={() => router.push("/onboarding")}>Ver meus workspaces</Button>
      </CardContent>
    </Card>
  );
}
