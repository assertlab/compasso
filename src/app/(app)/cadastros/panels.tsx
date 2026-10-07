import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "./entity-dialog";
import { setOrganizationArchived, setProjectArchived } from "./actions";
import { OrganizationDialog, ProjectDialog, TagDialog } from "./entity-dialogs";
import type { Tenant } from "@/server/tenant";

type PanelProps = { tenant: Tenant; canEdit: boolean; includeArchived: boolean; basePath: string };

function Toolbar({
  canEdit,
  includeArchived,
  basePath,
  create,
  archivable = true,
}: Pick<PanelProps, "canEdit" | "includeArchived" | "basePath"> & { create: ReactNode; archivable?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {archivable ? (
        <Link
          href={includeArchived ? basePath : `${basePath}&arquivados=1`}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {includeArchived ? "Ocultar arquivados" : "Mostrar arquivados"}
        </Link>
      ) : (
        <span />
      )}
      {canEdit && create}
    </div>
  );
}

function Empty({ canEdit, what }: { canEdit: boolean; what: string }) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {canEdit ? `Nenhum item em ${what} ainda. Use o botão acima para criar o primeiro.` : `Nenhum item em ${what} ainda. Peça a um administrador para criar.`}
    </p>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="divide-y rounded-lg border">{children}</ul>;
}

function Row({ children }: { children: ReactNode }) {
  return <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">{children}</li>;
}

export async function OrganizationsPanel({ tenant, canEdit, includeArchived, basePath }: PanelProps) {
  const organizations = await tenant.organizations.list({ includeArchived });
  return (
    <div className="flex flex-col gap-3">
      <Toolbar canEdit={canEdit} includeArchived={includeArchived} basePath={basePath} create={<OrganizationDialog />} />
      {organizations.length === 0 ? (
        <Empty canEdit={canEdit} what="Organizações" />
      ) : (
        <List>
          {organizations.map((organization) => (
            <Row key={organization.id}>
              <p className="min-w-0 flex-1 truncate font-medium">{organization.name}</p>
              {organization.isArchived && <Badge variant="outline">Arquivada</Badge>}
              {canEdit && (
                <div className="flex items-center gap-1">
                  <OrganizationDialog organization={organization} />
                  <ActionButton
                    action={setOrganizationArchived}
                    fields={{ id: organization.id, archived: String(!organization.isArchived) }}
                  >
                    {organization.isArchived ? "Restaurar" : "Arquivar"}
                  </ActionButton>
                </div>
              )}
            </Row>
          ))}
        </List>
      )}
    </div>
  );
}

export async function ProjectsPanel({ tenant, canEdit, includeArchived, basePath }: PanelProps) {
  const [projects, organizations] = await Promise.all([
    tenant.projects.list({ includeArchived }),
    tenant.organizations.list({ includeArchived: true }),
  ]);
  const organizationName = new Map(organizations.map((organization) => [organization.id, organization.name]));
  const activeOrganizations = organizations.filter((organization) => !organization.isArchived);
  return (
    <div className="flex flex-col gap-3">
      <Toolbar
        canEdit={canEdit}
        includeArchived={includeArchived}
        basePath={basePath}
        create={<ProjectDialog organizations={activeOrganizations} />}
      />
      {projects.length === 0 ? (
        <Empty canEdit={canEdit} what="Projetos" />
      ) : (
        <List>
          {projects.map((project) => (
            <Row key={project.id}>
              <span className="size-3 shrink-0 rounded-full border" style={{ backgroundColor: project.color }} aria-hidden />
              <div className="min-w-0 flex-1">
                <Link href={`/cadastros/projetos/${project.id}`} className="block truncate font-medium underline-offset-4 hover:underline">
                  {project.name}
                </Link>
                <p className="truncate text-sm text-muted-foreground">{organizationName.get(project.organizationId)}</p>
              </div>
              {project.isArchived && <Badge variant="outline">Arquivado</Badge>}
              {canEdit && (
                <div className="flex items-center gap-1">
                  <ProjectDialog project={project} organizations={activeOrganizations} />
                  <ActionButton action={setProjectArchived} fields={{ id: project.id, archived: String(!project.isArchived) }}>
                    {project.isArchived ? "Restaurar" : "Arquivar"}
                  </ActionButton>
                </div>
              )}
            </Row>
          ))}
        </List>
      )}
    </div>
  );
}

export async function TagsPanel({ tenant, canEdit, includeArchived, basePath }: PanelProps) {
  const tags = await tenant.tags.list();
  return (
    <div className="flex flex-col gap-3">
      <Toolbar canEdit={canEdit} includeArchived={includeArchived} basePath={basePath} create={<TagDialog />} archivable={false} />
      {tags.length === 0 ? (
        <Empty canEdit={canEdit} what="Tags" />
      ) : (
        <List>
          {tags.map((tag) => (
            <Row key={tag.id}>
              <span className="size-3 shrink-0 rounded-full border" style={{ backgroundColor: tag.color }} aria-hidden />
              <p className="min-w-0 flex-1 truncate font-medium">{tag.name}</p>
              {canEdit && <TagDialog tag={tag} />}
            </Row>
          ))}
        </List>
      )}
    </div>
  );
}
