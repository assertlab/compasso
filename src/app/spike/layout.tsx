// SPIKE (ADR-033): throwaway pages to exercise Better Auth. Never merged into `develop`.
export const metadata = { title: "Spike Better Auth", robots: { index: false } };

export default function SpikeLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">{children}</main>;
}
