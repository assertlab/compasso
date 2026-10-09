"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Providers = { google: boolean; github: boolean };

// After signing in or out, navigate with a full page load instead of router.replace(): Next keeps the state of
// pages the person left (a stale "Entrando…" form) and a client cache that may hold the previous account's pages.
export function SignInForm({ next, providers, socialFailed }: { next: string; providers: Providers; socialFailed?: boolean }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(socialFailed ? "Não foi possível entrar com essa conta. Tente o código por e-mail." : null);
  const [pending, setPending] = useState(false);

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error: err } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "sign-in" });
    setPending(false);
    if (err) return setError(err.status === 429 ? "Muitas tentativas. Aguarde um minuto e tente de novo." : "Não foi possível enviar o código. Confira o e-mail.");
    setStep("code");
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error: err } = await authClient.signIn.emailOtp({ email: email.trim(), otp: code.trim() });
    if (err) {
      setPending(false);
      return setError("Código inválido ou expirado.");
    }
    window.location.replace(next);
  }

  async function social(provider: "google" | "github") {
    setError(null);
    await authClient.signIn.social({ provider, callbackURL: next, errorCallbackURL: "/sign-in?error=social" });
  }

  return (
    <Card className="w-[25rem] max-w-full">
      <CardHeader>
        <CardTitle>Entrar ou criar conta</CardTitle>
        <CardDescription>
          {step === "email" ? "Enviamos um código de 6 dígitos para o seu e-mail. Sem senha." : `Digite o código enviado para ${email.trim()}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {step === "email" ? (
          <form onSubmit={sendCode} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando…" : "Receber código"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                className="text-center font-mono text-lg tracking-[0.4em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <Button type="submit" disabled={pending || code.length !== 6}>
              {pending ? "Entrando…" : "Entrar"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setStep("email"); setCode(""); setError(null); setPending(false); }}>
              Usar outro e-mail
            </Button>
          </form>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {step === "email" && (providers.google || providers.github) && (
          <div className="grid gap-2 border-t pt-4">
            {providers.google && (
              <Button type="button" variant="outline" onClick={() => social("google")}>
                Continuar com Google
              </Button>
            )}
            {providers.github && (
              <Button type="button" variant="outline" onClick={() => social("github")}>
                Continuar com GitHub
              </Button>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Primeiro acesso? Use o mesmo e-mail: a conta é criada automaticamente.</p>
      </CardContent>
    </Card>
  );
}

/** The signed-in person was refused (deleted account or archived workspace). Offer to sign out instead of looping. */
export function UnavailableNotice() {
  return (
    <Card className="w-[25rem] max-w-full">
      <CardHeader>
        <CardTitle>Acesso indisponível</CardTitle>
        <CardDescription>Esta conta ou este workspace não está mais disponível. Saia e entre com outra conta, ou fale com quem administra o workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={async () => {
            await authClient.signOut();
            window.location.replace("/sign-in");
          }}
        >
          Sair
        </Button>
      </CardContent>
    </Card>
  );
}
