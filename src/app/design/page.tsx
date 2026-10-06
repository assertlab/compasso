import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Plus, Square } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const swatches = [
  ["background", "bg-background"],
  ["card", "bg-card"],
  ["muted", "bg-muted"],
  ["secondary", "bg-secondary"],
  ["accent", "bg-accent"],
  ["primary", "bg-primary"],
  ["running", "bg-running"],
  ["destructive", "bg-destructive"],
  ["border", "bg-border"],
  ["input", "bg-input"],
] as const;

const entries = [
  { day: "03/02", org: "Acme Logística", project: "Modernização da Plataforma", desc: "Documentação de arquitetura da solução", tag: "Revisão", time: "03:00:00" },
  { day: "03/02", org: "Acme Logística", project: "Modernização da Plataforma", desc: "Organização e comunicação", tag: "Gestão", time: "01:30:00" },
  { day: "04/02", org: "Interno", project: "Pesquisa e extensão", desc: "Alinhamento sobre requisitos", tag: "Reunião", time: "00:40:00" },
  { day: "05/02", org: "Acme Logística", project: "Modernização da Plataforma", desc: "Estudo da documentação de requisitos", tag: "Estudo", time: "04:25:00" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  // Reference page: hidden in production deployments.
  if (process.env.VERCEL_ENV === "production") notFound();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Logo />
          <nav className="flex items-center gap-1">
            <Button variant="ghost" size="sm">Registro</Button>
            <Button variant="ghost" size="sm">Relatórios</Button>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Design system</h1>
          <p className="max-w-prose text-muted-foreground">
            Referência viva do Compasso: tokens, tipografia e componentes. Sóbrio, denso e legível,
            com o vermelho reservado ao que está em andamento ou exige atenção.
          </p>
        </div>

        <Section title="Cronômetro">
          <Card>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Input aria-label="Descrição da atividade" placeholder="No que você está trabalhando?" className="sm:flex-1" />
              <Select defaultValue="p1">
                <SelectTrigger aria-label="Projeto" className="sm:w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="p1">Acme · Modernização da Plataforma</SelectItem>
                  <SelectItem value="p2">Interno · Pesquisa e extensão</SelectItem>
                </SelectContent>
              </Select>
              <time className="font-mono text-2xl font-medium tabular-nums sm:w-32 sm:text-right">01:24:09</time>
              <Button className="bg-running text-running-foreground hover:bg-running/90">
                <Square aria-hidden /> Parar
              </Button>
            </CardContent>
          </Card>
        </Section>

        <Section title="Cores">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {swatches.map(([name, cls]) => (
              <div key={name} className="flex flex-col gap-1.5">
                <div className={`h-12 rounded-md border ${cls}`} />
                <span className="font-mono text-xs text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Tipografia">
          <Card>
            <CardContent className="flex flex-col gap-3">
              <p className="text-3xl font-semibold tracking-tight">Relatório mensal de horas</p>
              <p className="text-lg font-semibold">Título de seção (IBM Plex Sans 600)</p>
              <p>Texto corrido em IBM Plex Sans 400, pensado para leitura longa e telas pequenas.</p>
              <p className="text-sm text-muted-foreground">Texto auxiliar, descrições e metadados.</p>
              <p className="font-mono text-2xl tabular-nums">79:28:00 · 1234,56 h</p>
              <p className="font-mono text-sm text-muted-foreground">IBM Plex Mono para valores, horas e códigos</p>
            </CardContent>
          </Card>
        </Section>

        <Section title="Botões e badges">
          <div className="flex flex-wrap items-center gap-3">
            <Button><Plus aria-hidden /> Novo registro</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="outline">Contorno</Button>
            <Button variant="ghost">Discreto</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Excluir</Button>
            <Button disabled>Desabilitado</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Faturável</Badge>
            <Badge variant="secondary">Revisão</Badge>
            <Badge variant="outline">Gestão</Badge>
            <Badge variant="destructive">Em andamento</Badge>
          </div>
        </Section>

        <Section title="Formulário e diálogo">
          <div className="grid max-w-xl gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="org">Organização</Label>
              <Input id="org" placeholder="Nome da empresa ou do cliente" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="inv">Campo inválido</Label>
              <Input id="inv" aria-invalid defaultValue="2026-13-45" />
              <p className="text-sm text-destructive">Data inválida.</p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-fit">Abrir diálogo</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Excluir registro?</DialogTitle>
                  <DialogDescription>Esta ação remove o registro de horas e não pode ser desfeita.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline">Cancelar</Button>
                  <Button variant="destructive">Excluir</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Section>

        <Section title="Tabela e resumo">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader><CardDescription>Horas no mês</CardDescription></CardHeader>
              <CardContent className="pt-2"><p className="font-mono text-3xl font-medium tabular-nums">79:28</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardDescription>Faturáveis</CardDescription></CardHeader>
              <CardContent className="pt-2"><p className="font-mono text-3xl font-medium tabular-nums">79:28</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardDescription>Registros</CardDescription></CardHeader>
              <CardContent className="pt-2"><p className="font-mono text-3xl font-medium tabular-nums">52</p></CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Registros de fevereiro</CardTitle>
              <CardDescription>Agrupados por organização e projeto</CardDescription>
            </CardHeader>
            <CardContent className="px-2 pt-3 pb-2">
              <ul className="flex flex-col divide-y sm:hidden" aria-label="Registros">
                {entries.map((e, i) => (
                  <li key={i} className="flex flex-col gap-1 px-3 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-xs text-muted-foreground">
                        <span className="tabular-nums">{e.day}</span> · {e.org} · {e.project}
                      </span>
                      <span className="font-mono text-sm tabular-nums">{e.time}</span>
                    </div>
                    <p>{e.desc}</p>
                    <div><Badge variant="secondary">{e.tag}</Badge></div>
                  </li>
                ))}
                <li className="flex justify-between px-3 py-3 font-medium">
                  <span>Total</span>
                  <span className="font-mono tabular-nums">09:35:00</span>
                </li>
              </ul>
              <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dia</TableHead>
                    <TableHead>Organização · Projeto</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead data-numeric className="text-right">Duração</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="tabular-nums">{e.day}</TableCell>
                      <TableCell>
                        <span className="font-medium">{e.org}</span>
                        <span className="text-muted-foreground"> · {e.project}</span>
                      </TableCell>
                      <TableCell>{e.desc}</TableCell>
                      <TableCell><Badge variant="secondary">{e.tag}</Badge></TableCell>
                      <TableCell data-numeric className="text-right font-mono">{e.time}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4}>Total</TableCell>
                    <TableCell data-numeric className="text-right font-mono">09:35:00</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
              </div>
            </CardContent>
          </Card>
        </Section>
      </main>
    </div>
  );
}
