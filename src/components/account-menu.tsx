"use client";

import { Building2, LogOut, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";

function initials(name: string | undefined, email: string | undefined) {
  const source = (name?.trim() || email || "?").split(/[\s@.]+/).filter(Boolean);
  return ((source[0]?.[0] ?? "?") + (source.length > 1 ? (source[1]?.[0] ?? "") : "")).toUpperCase();
}

/** Workspace name + account button; one dialog holds the account, the workspace switcher and sign-out (no extra menu dependency). */
export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const session = authClient.useSession();
  const orgs = authClient.useListOrganizations();
  // Not `useActiveOrganization()`: that endpoint returns every member and pending invitation to every member (COMP-012).
  const activeId = session.data?.session.activeOrganizationId;
  const active = (orgs.data ?? []).find((org) => org.id === activeId);

  async function switchTo(organizationId: string) {
    await authClient.organization.setActive({ organizationId });
    setOpen(false);
    window.location.replace("/");
  }

  async function signOut() {
    await authClient.signOut();
    window.location.replace("/sign-in");
  }

  const user = session.data?.user;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="min-w-0 gap-2 px-2">
          <span className="hidden min-w-0 max-w-40 truncate text-sm sm:inline">{active?.name ?? ""}</span>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {initials(user?.name, user?.email)}
          </span>
          <span className="sr-only">Conta e workspace</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user?.name || user?.email}</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <p className="text-sm font-medium">Workspaces</p>
          {(orgs.data ?? []).map((org) => (
            <Button key={org.id} variant={org.id === activeId ? "secondary" : "outline"} className="justify-start" onClick={() => switchTo(org.id)}>
              <Building2 aria-hidden />
              {org.name}
            </Button>
          ))}
          <Button asChild variant="ghost" className="justify-start" onClick={() => setOpen(false)}>
            <Link href="/onboarding">
              <Plus aria-hidden />
              Criar ou ver convites
            </Link>
          </Button>
        </div>
        <Button variant="outline" onClick={signOut}>
          <LogOut aria-hidden />
          Sair
        </Button>
      </DialogContent>
    </Dialog>
  );
}
