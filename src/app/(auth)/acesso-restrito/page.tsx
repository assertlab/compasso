import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CONTACT_EMAIL, RESPONSIBLE, SERVICE_NAME } from "@/lib/legal";

export const metadata = { title: "Acesso restrito" };

/** Where someone lands when they try to sign up while the service is in closed beta (ADR-038). Static: no session, no data. */
export default function AcessoRestritoPage() {
  return (
    <Card className="w-[25rem] max-w-full">
      <CardHeader>
        <CardTitle>Acesso restrito</CardTitle>
        <CardDescription>
          O {SERVICE_NAME} está em beta fechado: por enquanto, só entram pessoas convidadas pelo grupo {RESPONSIBLE}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <p>
          Se você foi convidado, confira se está usando o mesmo e-mail do convite. Se acha que deveria ter acesso, ou quer pedir um, escreva para{" "}
          <a className="font-medium underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Pedido de acesso ao Compasso")}`}>
            {CONTACT_EMAIL}
          </a>{" "}
          dizendo o e-mail que você usaria para entrar.
        </p>
        <p className="text-muted-foreground">Nenhuma conta foi criada e nenhum dado seu foi guardado por esta tentativa.</p>
        <div>
          <Button asChild variant="outline">
            <Link href="/sign-in">Voltar à entrada</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
