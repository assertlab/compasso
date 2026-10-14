"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMyAccount, sendDeletionCode, type DeleteAccountState } from "./actions";

/** "Zona de perigo": immediate, irreversible deletion. Blocked workspaces are listed instead of a button. */
export function DeleteAccountCard({ blockedBy, archive }: { blockedBy: string[]; archive: string[] }) {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(deleteMyAccount, { ok: false });
  const [sent, setSent] = useState<DeleteAccountState | null>(null);
  const [sending, startSending] = useTransition();
  const codeSent = state.codeSent || sent?.codeSent;
  const message = state.message ?? (sent && !sent.ok ? sent.message : undefined);

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">Excluir minha conta</CardTitle>
        <CardDescription>A exclusão é imediata e não pode ser desfeita.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex flex-col gap-2">
          <p>
            Seu nome, e-mail e acessos são apagados e você sai de todos os workspaces. As horas que você registrou continuam nos workspaces, atribuídas a <strong>Usuário removido</strong>, para que os relatórios
            fechados não mudem. Baixe antes uma cópia dos seus dados, se quiser, no cartão acima.
          </p>
          {archive.length > 0 && (
            <p className="text-muted-foreground">
              Workspaces em que você é a única pessoa serão arquivados (os dados ficam guardados, sem acesso): {archive.join(", ")}.
            </p>
          )}
        </div>

        {blockedBy.length > 0 ? (
          <p role="alert" className="rounded-md border border-destructive/50 p-3 text-destructive">
            Você é a única pessoa administradora de {blockedBy.map((n) => `"${n}"`).join(", ")}, que tem outros membros. Promova outra pessoa a administradora e volte aqui para excluir a conta.
          </p>
        ) : !codeSent ? (
          <div>
            <Button
              type="button"
              variant="destructive"
              disabled={sending}
              onClick={() => startSending(async () => setSent(await sendDeletionCode()))}
            >
              Enviar código por e-mail
            </Button>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-3">
            <p>Enviamos um código de 6 dígitos para o seu e-mail. Ele vale por 10 minutos.</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delete-code">Código recebido por e-mail</Label>
              <Input id="delete-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="max-w-40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delete-confirmation">Digite EXCLUIR para confirmar</Label>
              <Input id="delete-confirmation" name="confirmation" autoComplete="off" required className="max-w-40" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Excluindo…" : "Excluir minha conta para sempre"}
              </Button>
              <Button type="button" variant="outline" disabled={sending} onClick={() => startSending(async () => setSent(await sendDeletionCode()))}>
                Reenviar código
              </Button>
            </div>
          </form>
        )}
        {message && (
          <p role="alert" className="text-destructive">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
