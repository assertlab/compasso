import { OrganizationList } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { Logo } from "@/components/logo";

export const metadata = { title: "Escolher workspace" };

export default function OnboardingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <Logo />
      <Suspense fallback={<div className="h-40 w-80 animate-pulse rounded-lg bg-muted" aria-hidden />}>
        <Picker />
      </Suspense>
    </main>
  );
}

async function Picker() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
  return (
    <>
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">Escolha ou crie um workspace</h1>
        <p className="text-sm text-muted-foreground">
          O workspace reúne as horas, os projetos e os membros do seu time. Use um por empregador ou grupo.
        </p>
      </div>
      <OrganizationList hidePersonal afterSelectOrganizationUrl="/" afterCreateOrganizationUrl="/" />
    </>
  );
}
