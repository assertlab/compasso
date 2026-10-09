import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteFooter } from "@/components/site-footer";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r bg-background lg:block" aria-hidden />}>
        <AppSidebar />
      </Suspense>
      <div className="flex flex-1 flex-col lg:pl-60">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">{children}</main>
        <SiteFooter />
      </div>
    </>
  );
}
