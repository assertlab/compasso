"use client";

import { UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import { INVITATIONS_CHANGED } from "./pending-invitations";

/**
 * Sends an e-mail invitation through Better Auth (the organization plugin; the invite expires in 48 h and only
 * the invited e-mail can accept it). Pending invites are listed (and can be resent or cancelled) by PendingInvitations.
 */
export function InviteMembersButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await authClient.organization.inviteMember({ email: email.trim().toLowerCase(), role, resend: true });
    setBusy(false);
    if (error) return setMessage({ ok: false, text: "Não foi possível enviar o convite. Confira o e-mail e se você é administrador." });
    setMessage({ ok: true, text: `Convite enviado para ${email.trim()}. Vale por 48 horas.` });
    setEmail("");
    window.dispatchEvent(new Event(INVITATIONS_CHANGED));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setMessage(null); }}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <UserPlus aria-hidden />
          Convidar pessoas
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar pessoa</DialogTitle>
          <DialogDescription>Ela recebe um e-mail com o link. Entra com esse mesmo e-mail e aceita o convite.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="invite-email">E-mail</Label>
            <Input id="invite-email" type="email" required autoFocus autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="invite-role">Papel</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "member" | "admin")}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Membro (registra horas nos seus projetos)</SelectItem>
                <SelectItem value="admin">Administrador (acesso total)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {message && (
            <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
              {message.text}
            </p>
          )}
          <Button type="submit" disabled={busy || !email.trim()}>{busy ? "Enviando…" : "Enviar convite"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
