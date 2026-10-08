"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/ba/auth-client";

export function AcceptInvitation({ id }: { id: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Aceitar convite</h1>
      <p className="text-sm">Entre com o MESMO e-mail do convite (em /spike/sign-in) e depois aceite aqui.</p>
      <Button
        onClick={async () => {
          const res = await authClient.organization.acceptInvitation({ invitationId: id });
          if (res.error) return setMsg(res.error.message ?? "Erro");
          window.location.assign("/spike");
        }}
      >
        Aceitar
      </Button>
      {msg ? <p role="alert" className="text-sm text-destructive">{msg}</p> : null}
    </div>
  );
}
