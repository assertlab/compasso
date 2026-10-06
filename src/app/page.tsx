export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Compasso</h1>
      <p className="text-sm text-muted-foreground">
        Registro de horas simples, robusto e sem paywall.
      </p>
      <p className="font-mono text-2xl tabular-nums">00:00:00</p>
    </main>
  );
}
