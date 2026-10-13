"use client";

import { type FormEvent, useState } from "react";
import { GitHubIcon, GoogleIcon } from "@/components/brand-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTurnstile } from "@/components/turnstile-widget";
import { authClient } from "@/lib/auth-client";
import { TURNSTILE_HEADER } from "@/lib/turnstile";

type Providers = { google: boolean; github: boolean };

// After signing in or out, navigate with a full page load instead of router.replace(): Next keeps the state of
// pages the person left (a stale "Entrando…" form) and a client cache that may hold the previous account's pages.
export function SignInForm({ next, providers, turnstileSiteKey, socialFailed }: { next: string; providers: Providers; turnstileSiteKey?: string; socialFailed?: boolean }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(socialFailed ? "Não foi possível entrar com essa conta. Tente o código por e-mail." : null);
  const [pending, setPending] = useState(false);
  const { containerRef, token: challengeToken, status: challengeStatus, reset: resetChallenge } = useTurnstile(turnstileSiteKey);
  // With a site key the request needs a fresh token (single use); without one the challenge is off.
  const needsToken = Boolean(turnstileSiteKey);
  // Waiting for the challenge; if it failed to load the button stays usable so the server's answer explains what to do.
  const verifying = needsToken && !challengeToken && challengeStatus !== "error";

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error: err } = await authClient.emailOtp.sendVerificationOtp(
      { email: email.trim(), type: "sign-in" },
      needsToken && challengeToken ? { headers: { [TURNSTILE_HEADER]: challengeToken } } : undefined,
    );
    setPending(false);
    if (err) {
      resetChallenge(); // the token was spent, successful or not
      if (err.status === 429) return setError("Muitas tentativas. Aguarde um minuto e tente de novo.");
      if (err.status === 400 || err.status === 403 || err.status === 500) {
        return setError(needsToken ? "Não foi possível confirmar que você é uma pessoa. Recarregue a página e tente de novo." : "Não foi possível enviar o código. Confira o e-mail.");
      }
      return setError("Não foi possível enviar o código. Confira o e-mail.");
    }
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
            {needsToken && <div ref={containerRef} />}
            <Button type="submit" disabled={pending || verifying}>
              {pending ? "Enviando…" : verifying ? "Verificando…" : "Receber código"}
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
        {(error || (step === "email" && needsToken && challengeStatus === "error")) && (
          <p role="alert" className="text-sm text-destructive">
            {error ?? "A verificação de segurança não carregou. Recarregue a página ou desative bloqueadores de conteúdo para este site."}
          </p>
        )}
        {step === "email" && (providers.google || providers.github) && (
          <div className="grid gap-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
              <span className="h-px flex-1 bg-border" />
              ou
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className={providers.google && providers.github ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
              {providers.google && (
                <Button type="button" variant="outline" size="sm" aria-label="Continuar com Google" onClick={() => social("google")}>
                  <GoogleIcon className="size-4" />
                  Google
                </Button>
              )}
              {providers.github && (
                <Button type="button" variant="outline" size="sm" aria-label="Continuar com GitHub" onClick={() => social("github")}>
                  <GitHubIcon className="size-4" />
                  GitHub
                </Button>
              )}
            </div>
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
