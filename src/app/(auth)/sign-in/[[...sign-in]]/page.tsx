import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export const metadata = { title: "Entrar" };

// Clerk's UI reads the pathname on the client; Next 16 (cacheComponents) needs it behind Suspense.
export default function SignInPage() {
  return (
    <Suspense fallback={<div className="h-96 w-[25rem] max-w-full animate-pulse rounded-lg bg-muted" aria-hidden />}>
      <SignIn />
    </Suspense>
  );
}
