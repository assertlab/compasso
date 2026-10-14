import { Download } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspaceContext } from "@/server/workspace-context";

export const metadata: Metadata = { title: "Minha conta" };

export default function ContaPage() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" aria-hidden />}>
      <Conta />
    </Suspense>
  );
}

async function Conta() {
  await requireWorkspaceContext();
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Minha conta</h1>
        <p className="text-sm text-muted-foreground">Seus dados no Compasso.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exportar meus dados</CardTitle>
          <CardDescription>Baixe uma cópia dos seus dados em um arquivo JSON.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 text-sm">
            <p>
              O arquivo reúne os seus registros de horas em todos os workspaces em que você trabalhou, inclusive os removidos e o cronômetro em andamento, com início e término em UTC e o fuso de cada registro. Traz também os
              nomes de clientes, projetos, tarefas e tags que esses registros usam, e os dados da sua conta.
            </p>
            <p className="text-muted-foreground">Não inclui dados de outras pessoas. Para relatórios por período em planilha ou PDF, use a página Relatórios.</p>
          </div>
          <div>
            <Button asChild>
              <a href="/conta/export">
                <Download aria-hidden />
                Baixar meus dados (JSON)
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
