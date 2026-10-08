"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/ba/auth-client";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setBusy(false);
    if (res.error) setError(res.error.message ?? "Não foi possível enviar o código.");
    else setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await authClient.signIn.emailOtp({ email, otp });
    if (res.error) {
      setBusy(false);
      setError(res.error.message ?? "Código inválido.");
      return;
    }
    window.location.assign("/spike");
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Entrar (spike Better Auth)</h1>
      {step === "email" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-2">
          <Input type="email" required autoComplete="email" placeholder="voce@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" disabled={busy}>Enviar código por e-mail</Button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Código enviado para {email}. Sem RESEND_API_KEY, ele aparece no console do servidor.</p>
          <Input inputMode="numeric" autoComplete="one-time-code" required maxLength={6} placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value)} />
          <Button type="submit" disabled={busy}>Entrar</Button>
        </form>
      )}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/spike" })}>Google</Button>
        <Button variant="outline" onClick={() => authClient.signIn.social({ provider: "github", callbackURL: "/spike" })}>GitHub</Button>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
