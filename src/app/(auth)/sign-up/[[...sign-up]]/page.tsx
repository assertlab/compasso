import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export const metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="h-96 w-[25rem] max-w-full animate-pulse rounded-lg bg-muted" aria-hidden />}>
      <SignUp />
    </Suspense>
  );
}
