export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Compasso</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Registro de horas simples, robusto e sem paywall.
      </p>
      <p className="font-mono text-2xl tabular-nums">00:00:00</p>
    </main>
  );
}
