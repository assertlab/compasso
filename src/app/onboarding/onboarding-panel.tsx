"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { workspaceSlug } from "@/lib/workspace-slug";
import { Invitations } from "./invitations";

/** First access: name (e-mail sign-up leaves it empty) → pending invitations → own workspaces → create one. */
export function OnboardingPanel({ email, initialName }: { email: string; initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [hasName, setHasName] = useState(Boolean(initialName));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");

  const orgs = authClient.useListOrganizations();

  async function run(action: () => Promise<{ error?: { message?: string } | null }>, fallback: string, done?: () => void) {
    setBusy(true);
    setError(null);
    const { error: err } = await action();
    setBusy(false);
    if (err) return setError(fallback);
    done?.();
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    await run(() => authClient.updateUser({ name: name.trim() }), "Não foi possível salvar o nome.", () => {
      setHasName(true);
      router.refresh();
    });
  }

  async function enter(organizationId: string) {
    await run(() => authClient.organization.setActive({ organizationId }), "Não foi possível abrir o workspace.", () => {
      window.location.replace("/");
    });
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    const trimmed = workspaceName.trim();
    await run(
      async () => {
        const created = await authClient.organization.create({ name: trimmed, slug: workspaceSlug(trimmed) });
        if (created.error) return created;
        return authClient.organization.setActive({ organizationId: created.data.id });
      },
      "Não foi possível criar o workspace.",
      () => {
        window.location.replace("/");
      },
    );
  }

  if (!hasName) {
    return (
      <Card className="w-[25rem] max-w-full">
        <CardHeader>
          <CardTitle>Como devemos te chamar?</CardTitle>
          <CardDescription>Seu nome aparece nos registros e relatórios. Conta: {email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveName} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" required autoFocus autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy || !name.trim()}>Continuar</Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid w-[25rem] max-w-full gap-4">
      <div className="text-center">
        <h1 className="text-lg font-semibold">Escolha ou crie um workspace</h1>
        <p className="text-sm text-muted-foreground">
          O workspace reúne as horas, os projetos e os membros do seu time. Use um por empregador ou grupo.
        </p>
      </div>
      <Invitations onAccepted={(organizationId) => enter(organizationId)} />
      {orgs.data && orgs.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Seus workspaces</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {orgs.data.map((org) => (
              <Button key={org.id} variant="outline" className="justify-start" disabled={busy} onClick={() => enter(org.id)}>
                {org.name}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Criar um workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="workspace">Nome</Label>
              <Input id="workspace" required maxLength={60} placeholder="Ex.: Minha consultoria" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy || !workspaceName.trim()}>Criar e entrar</Button>
          </form>
        </CardContent>
      </Card>
      {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
