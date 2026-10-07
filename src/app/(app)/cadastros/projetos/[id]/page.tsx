import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { NotFoundError } from "@/server/errors";
import { getTenant } from "@/server/get-tenant";
import type { Tenant } from "@/server/tenant";
import { setTaskCompleted } from "../../actions";
import { ActionButton } from "../../entity-dialog";
import { TaskDialog } from "../../entity-dialogs";

export const metadata: Metadata = { title: "Projeto" };

export default function ProjectPage({ params }: PageProps<"/cadastros/projetos/[id]">) {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" aria-hidden />}>
      <Project params={params} />
    </Suspense>
  );
}

async function load(tenant: Tenant, id: string) {
  try {
    const project = await tenant.projects.get(id);
    const [organization, tasks] = await Promise.all([tenant.organizations.get(project.organizationId), tenant.tasks.list(id)]);
    return { project, organization, tasks };
  } catch (error) {
    // Unknown id or an id from another workspace: same answer.
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

async function Project({ params }: Pick<PageProps<"/cadastros/projetos/[id]">, "params">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const { ctx, tenant } = await getTenant();
  const canEdit = ctx.role === "admin";

  const { project, organization, tasks } = await load(tenant, id);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href="/cadastros?aba=projetos" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Projetos
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="size-3 shrink-0 rounded-full border" style={{ backgroundColor: project.color }} aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          {project.isArchived && <Badge variant="outline">Arquivado</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{organization.name}</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Tarefas</h2>
        {canEdit && <TaskDialog projectId={project.id} />}
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {canEdit ? "Nenhuma tarefa ainda. Crie a primeira para registrar horas nela." : "Nenhuma tarefa ainda. Peça a um administrador para criar."}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <p className={task.isCompleted ? "min-w-0 flex-1 truncate text-muted-foreground line-through" : "min-w-0 flex-1 truncate font-medium"}>
                {task.name}
              </p>
              {task.isCompleted && <Badge variant="outline">Concluída</Badge>}
              {canEdit && (
                <div className="flex items-center gap-1">
                  <TaskDialog projectId={project.id} task={task} />
                  <ActionButton action={setTaskCompleted} fields={{ id: task.id, completed: String(!task.isCompleted) }}>
                    {task.isCompleted ? "Reabrir" : "Concluir"}
                  </ActionButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
