# Compasso

Registro de horas simples, robusto e sem paywall. Aplicação web (PWA) para consultores, freelancers e equipes que registram o tempo por cliente, projeto e tarefa e precisam exportar o relatório do mês em XLSX, CSV ou PDF sem restrições.

Em produção: **[compasso.assertlab.com](https://compasso.assertlab.com)** · Projeto do [ASSERT Lab](https://assertlab.com) (CIn/UFPE) · Versões 0.x: o produto ainda não está aberto ao público (ver o [CHANGELOG](./CHANGELOG.md)).

![Tela Registros do Compasso, com o cronômetro, a seleção de projeto e a lista de registros do dia](./docs/guia-de-uso/img/04-registros.png)

## O que faz

- **Registro de tempo:** cronômetro (um ativo por pessoa), lançamento manual, edição, duplicação e histórico agrupado por semana e dia.
- **Calendário semanal:** lançar arrastando em um espaço vazio, mover e redimensionar blocos.
- **Painel e relatórios:** horas por período, cliente, projeto, tarefa e pessoa, com gráficos e visão por dia ou semana.
- **Exportação sem paywall:** XLSX, CSV e PDF, com horas como números reais.
- **Cadastros e acesso:** clientes, projetos, tarefas e tags; papéis de proprietário, administrador e membro; convites por e-mail.
- **Login sem senha:** código por e-mail, Google ou GitHub. Instalável como PWA, com aviso de modo offline.

Quer ver as telas e o passo a passo? Leia o **[guia de uso](./docs/guia-de-uso/README.md)**.

## Documentação

| Documento | Para quê |
| :-- | :-- |
| [Guia de uso](./docs/guia-de-uso/README.md) | Como usar o app, tela por tela |
| [CHANGELOG](./CHANGELOG.md) | O que mudou em cada versão |
| [design-system.md](./design-system.md) | Tokens, componentes e convenções visuais |
| [CLAUDE.md](./CLAUDE.md) e [AGENTS.md](./AGENTS.md) | Regras de código, arquitetura e fluxo de trabalho (valem para pessoas e agentes) |

## Modelo

```
Workspace (tenant, 1:1 com a organização do Better Auth)
  └─ Cliente (empresa própria ou de terceiros; `organizations` no código)
       └─ Projeto
            └─ Tarefa
Tags são do workspace. Papéis por workspace: admin | membro.
```

O membro vê só as próprias horas e lança nos projetos de que participa; o admin vê as de todos e pode corrigir registros com trilha de auditoria.

## Stack

Next.js (App Router, TypeScript estrito) · Tailwind CSS · Drizzle ORM + Neon (PostgreSQL) · Better Auth (código por e-mail, Google/GitHub e organizações) · Zod · ExcelJS e `@react-pdf/renderer` (exportações) · Resend (e-mail) · Cloudflare Turnstile (login por código) · Vitest + PGlite · Vercel · IBM Plex (fontes self-hosted).

## Começando

Requisitos: Node 24 (ver `.nvmrc`) e um projeto no [Neon](https://neon.com).

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL
npm run db:migrate           # aplica as migrações no Neon
npm run dev                  # http://localhost:3000
```

O `.env.example` comenta cada variável. `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL` só são obrigatórios em produção. Em desenvolvimento, e-mail, login social e Turnstile são opcionais: sem a chave do Resend, o código de login aparece no terminal do servidor (linha `[mail:dev]`).

Para ter dados de exemplo, use `scripts/seed-demo.ts` (dados fictícios, simula por padrão e só grava com `--apply`; o cabeçalho do arquivo mostra o uso).

## Scripts

| Comando | O que faz |
| :-- | :-- |
| `npm run dev` / `build` / `start` | Servidor de desenvolvimento, build e produção |
| `npm run lint` / `typecheck` | ESLint e verificação de tipos |
| `npm test` / `test:watch` | Testes com Vitest (banco em memória com PGlite e as migrações reais) |
| `npm run db:generate` | Gera uma nova migração a partir de `src/db/schema.ts` |
| `npm run db:migrate` | Aplica as migrações |
| `npm run db:studio` | Abre o Drizzle Studio |

Antes de abrir um PR: `npm run typecheck && npm test && npm run build`.

## Estrutura

```
src/app/         rotas, layouts, manifest da PWA e ícones
src/components/  componentes de interface (src/components/ui: base do design system)
src/db/          schema Drizzle e cliente Neon
src/lib/         regras puras (tempo, relatórios, exportação) e seus testes
src/server/      acesso a dados por tenant, autenticação e regras de servidor
src/env.ts       validação das variáveis de ambiente
drizzle/         migrações versionadas
docs/            guia de uso, com capturas de tela
scripts/         manutenção (dados de exemplo, anonimização de conta)
brand/, public/  logos de origem e ícones da PWA
```

## Princípios

- Toda consulta operacional filtra por `workspace_id` (isolamento entre tenants).
- Instantes em UTC; o fuso IANA fica no usuário e em cada registro.
- A duração nunca é armazenada: deriva de `ended_at - started_at`.
- Um único cronômetro ativo por usuário (garantido por índice único parcial).
- Exportações escrevem números reais, nunca texto.
- Remoção é lógica; dados pessoais podem ser anonimizados (LGPD).

## Deploy e contribuição

A Vercel publica a branch `develop` (até a versão 1.0.0), então mergear um PR é publicar. Migrações em `drizzle/` precisam ser aplicadas no banco de produção **antes** do merge. O fluxo de branches, commits e revisão está em [CLAUDE.md](./CLAUDE.md).

## Licença

[MIT](./LICENSE).
