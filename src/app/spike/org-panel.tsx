"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/ba/auth-client";

export function OrgPanel({ orgs, activeId }: { orgs: { id: string; name: string }[]; activeId: string | null }) {
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [msg, setMsg] = useState<string | null>(null);

  const reload = () => window.location.reload();

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2, 6)}`;
    const res = await authClient.organization.create({ name, slug });
    if (res.error) return setMsg(res.error.message ?? "Erro");
    await authClient.organization.setActive({ organizationId: res.data.id });
    reload();
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const res = await authClient.organization.inviteMember({ email: inviteEmail, role, organizationId: activeId ?? undefined });
    setMsg(res.error ? (res.error.message ?? "Erro") : `Convite enviado para ${inviteEmail}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {orgs.map((o) => (
          <Button key={o.id} variant={o.id === activeId ? "default" : "outline"} onClick={async () => { await authClient.organization.setActive({ organizationId: o.id }); reload(); }}>
            {o.name}
          </Button>
        ))}
      </div>
      <form onSubmit={createOrg} className="flex gap-2">
        <Input required placeholder="Nova organização" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit">Criar</Button>
      </form>
      {activeId ? (
        <form onSubmit={invite} className="flex flex-wrap gap-2">
          <Input type="email" required placeholder="e-mail do convidado" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <select value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")} className="rounded-md border px-2 text-sm">
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
          <Button type="submit">Convidar</Button>
        </form>
      ) : null}
      <Button variant="outline" onClick={async () => { await authClient.signOut(); window.location.assign("/spike/sign-in"); }}>Sair</Button>
      {msg ? <p role="status" className="text-sm">{msg}</p> : null}
    </div>
  );
}
