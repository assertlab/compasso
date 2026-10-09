import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { parseTab, tabsFor } from "@/lib/cadastros";
import { cn } from "@/lib/utils";
import { getTenant } from "@/server/get-tenant";
import { MembersPanel, OrganizationsPanel, ProjectsPanel, TagsPanel } from "./panels";

export const metadata: Metadata = { title: "Cadastros" };

export default function CadastrosPage({ searchParams }: PageProps<"/cadastros">) {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" aria-hidden />}>
      <Cadastros searchParams={searchParams} />
    </Suspense>
  );
}

async function Cadastros({ searchParams }: Pick<PageProps<"/cadastros">, "searchParams">) {
  const params = await searchParams;
  const includeArchived = params.arquivados === "1";
  const { ctx, tenant } = await getTenant();
  const isAdmin = ctx.role === "admin";
  const tab = parseTab(params.aba, isAdmin);
  const panel = { tenant, canEdit: isAdmin, includeArchived, basePath: `/cadastros?aba=${tab}` };

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cadastros</h1>
        <p className="text-sm text-muted-foreground">
          Clientes, projetos e tags do workspace {ctx.workspaceName}.
          {ctx.role !== "admin" && " Somente administradores podem alterar."}
        </p>
      </div>

      <nav aria-label="Cadastros" className="flex gap-1 border-b">
        {tabsFor(isAdmin).map(({ key, label }) => (
          <Link
            key={key}
            href={`/cadastros?aba=${key}`}
            aria-current={key === tab ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              key === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "clientes" && <OrganizationsPanel {...panel} />}
      {tab === "projetos" && <ProjectsPanel {...panel} />}
      {tab === "tags" && <TagsPanel {...panel} />}
      {tab === "membros" && isAdmin && <MembersPanel tenant={tenant} workspaceId={ctx.workspaceId} currentUserId={ctx.userId} />}
    </section>
  );
}
