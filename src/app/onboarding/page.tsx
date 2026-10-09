import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { getAuth } from "@/server/auth/auth";
import { OnboardingPanel } from "./onboarding-panel";

export const metadata = { title: "Escolher workspace" };

export default function OnboardingPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-40 w-80 animate-pulse rounded-lg bg-muted" aria-hidden />}>
        <Panel />
      </Suspense>
    </AuthShell>
  );
}

async function Panel() {
  // Read the request first: during prerender this is what makes the page dynamic, before any DB/env access.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) redirect("/sign-in");
  return <OnboardingPanel email={session.user.email} initialName={session.user.name?.trim() ?? ""} />;
}
