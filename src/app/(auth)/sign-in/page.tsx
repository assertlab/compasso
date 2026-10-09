import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { safeNext } from "@/lib/safe-next";
import { getAuth } from "@/server/auth/auth";
import { getAuthEnv } from "@/server/auth/env";
import { SignInForm, UnavailableNotice } from "./sign-in-form";

export const metadata = { title: "Entrar" };

// Reading cookies/searchParams is dynamic: Next 16 (cacheComponents) needs it behind Suspense.
export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <Suspense fallback={<div className="h-72 w-[25rem] max-w-full animate-pulse rounded-lg bg-muted" aria-hidden />}>
      <SignInContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SignInContent({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : undefined);
  const error = typeof params.error === "string" ? params.error : undefined;

  const session = await getAuth().api.getSession({ headers: await headers() });
  // `unavailable` means the signed-in person was refused by the app: show why instead of redirecting back (loop).
  if (error === "unavailable") return <UnavailableNotice />;
  if (session) redirect(next);

  const env = getAuthEnv();
  const providers = {
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
  };
  return <SignInForm next={next} providers={providers} socialFailed={error === "social"} />;
}
