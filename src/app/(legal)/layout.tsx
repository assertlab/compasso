import Link from "next/link";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";

/** Public reading pages (Terms, Privacy). No session needed: they must open for someone who has not signed in yet. */
export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 pt-6">
        <Link href="/sign-in" aria-label="Compasso, voltar à entrada">
          <Logo />
        </Link>
        <Link href="/sign-in" className="text-sm underline underline-offset-4">
          Voltar à entrada
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter />
    </>
  );
}
