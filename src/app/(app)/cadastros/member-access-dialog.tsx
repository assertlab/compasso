"use client";

import { Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";

type Role = "admin" | "member";

/** Finds the Better Auth member id of someone by e-mail (the screen works with our own ids). */
async function memberIdOf(email: string): Promise<string | null> {
  const { data } = await authClient.organization.listMembers({ query: { limit: 100 } });
  return data?.members.find((m) => m.user.email.toLowerCase() === email.toLowerCase())?.id ?? null;
}

/**
 * Role change and removal. Authorization is enforced by Better Auth on the server (only admins and the owner may do it;
 * the owner cannot be demoted or removed); this dialog only reflects that. Removal is logical on our side: the person
 * loses access, the hours they logged stay (the `afterRemoveMember` hook marks the membership as removed).
 */
export function MemberAccessDialog({ email, name, role }: { email: string; name: string; role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState<Role>(role);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset(value: boolean) {
    setOpen(value);
    if (!value) {
      setNext(role);
      setConfirmRemove(false);
      setError(null);
    }
  }

  async function saveRole() {
    setBusy(true);
    setError(null);
    const memberId = await memberIdOf(email);
    const { error: err } = memberId ? await authClient.organization.updateMemberRole({ memberId, role: next }) : { error: { message: "not found" } };
    setBusy(false);
    if (err) return setError("Não foi possível mudar o papel. Só administradores podem fazer isso, e o proprietário não pode ser rebaixado.");
    reset(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.organization.removeMember({ memberIdOrEmail: email });
    setBusy(false);
    if (err) return setError("Não foi possível remover. O proprietário não pode ser removido.");
    reset(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost" aria-label={`Gerenciar acesso de ${name}`}>
          <Settings2 aria-hidden />
          Acesso
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acesso de {name}</DialogTitle>
          <DialogDescription>{email}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="member-role">Papel</Label>
          <Select value={next} onValueChange={(v) => setNext(v as Role)}>
            <SelectTrigger id="member-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Membro (registra horas nos projetos liberados)</SelectItem>
              <SelectItem value="admin">Administrador (acesso total)</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" onClick={saveRole} disabled={busy || next === role}>
            Salvar papel
          </Button>
        </div>
        <div className="grid gap-2 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Remover tira o acesso ao workspace. As horas já lançadas por {name} continuam nos relatórios.
          </p>
          {confirmRemove ? (
            <div className="flex gap-2">
              <Button type="button" variant="destructive" onClick={remove} disabled={busy}>
                Confirmar remoção
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirmRemove(false)} disabled={busy}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => setConfirmRemove(true)}>
              Remover do workspace
            </Button>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
