import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { getAuth } from "@/server/auth/auth";
import { AcceptInvitation } from "./accept-invitation";

export const metadata = { title: "Convite" };

export default function AcceptInvitationPage({ params }: PageProps<"/accept-invitation/[id]">) {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-40 w-80 animate-pulse rounded-lg bg-muted" aria-hidden />}>
        <Content params={params} />
      </Suspense>
    </AuthShell>
  );
}

async function Content({ params }: { params: PageProps<"/accept-invitation/[id]">["params"] }) {
  const { id } = await params;
  // Read the request first: during prerender this is what makes the page dynamic, before any DB/env access.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  // Signed-out people sign in (or sign up: same flow) with the invited e-mail and come back here.
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(`/accept-invitation/${id}`)}`);
  return <AcceptInvitation invitationId={id} email={session.user.email} />;
}
