import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getTenant } from "./tenant";
import { getAuth } from "@/server/ba/auth";
import { OrgPanel } from "./org-panel";

export default function SpikePage() {
  return (
    <Suspense fallback={<p>Carregando…</p>}>
      <SpikeContent />
    </Suspense>
  );
}

async function SpikeContent() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/spike/sign-in");
  const orgs = await getAuth().api.listOrganizations({ headers: await headers() });
  const activeId = session.session.activeOrganizationId ?? null;

  // Criterion (e): the same contract the app uses today, resolved from the Better Auth session.
  const ctx = activeId ? await getTenant().catch((e: unknown) => ({ error: String(e) })) : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Spike Better Auth</h1>
      <p className="text-sm">Logado como {session.user.email}</p>
      <OrgPanel orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} activeId={activeId} />
      <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(ctx, null, 2)}</pre>
    </div>
  );
}
