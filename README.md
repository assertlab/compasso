# Compasso

Registro de horas simples, robusto e sem paywall. Aplicação web (PWA) para consultores, freelancers e equipes que precisam registrar o tempo por organização, projeto e tarefa e exportar relatórios mensais em XLSX, CSV e PDF sem restrições.

> Projeto do [ASSERT Lab](https://assertlab.com) (CIn/UFPE). Status: MVP em construção.

## Modelo

```
Workspace (tenant, 1:1 com organização do Better Auth)
  └─ Organização (empresa própria ou cliente)
       └─ Projeto
            └─ Tarefa
Tags são do workspace. Papéis por workspace: admin | membro.
```

O membro vê só as próprias horas; o admin vê as de todos.

## Stack

Next.js (App Router, TypeScript estrito) · Tailwind CSS · Drizzle ORM + Neon (PostgreSQL) · Better Auth (e-mail com código, Google/GitHub e organizações) · Zod · Vitest · IBM Plex (fontes self-hosted).

## Começando

Requisitos: Node 22+ e um projeto no [Neon](https://neon.com).

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL
npm run db:migrate           # aplica as migrações no Neon
npm run dev                  # http://localhost:3000
```

## Scripts

| Comando | O que faz |
| :-- | :-- |
| `npm run dev` / `build` / `start` | Servidor de desenvolvimento, build e produção |
| `npm run lint` / `typecheck` | ESLint e verificação de tipos |
| `npm test` / `test:watch` | Testes com Vitest |
| `npm run db:generate` | Gera uma nova migração a partir de `src/db/schema.ts` |
| `npm run db:migrate` | Aplica as migrações |
| `npm run db:studio` | Abre o Drizzle Studio |

## Estrutura

```
src/app/        rotas, layout, manifest da PWA, ícones
src/db/         schema Drizzle e cliente Neon
src/lib/        regras de negócio puras (tempo, duração) e seus testes
src/env.ts      validação das variáveis de ambiente
drizzle/        migrações versionadas
brand/          logos de origem
public/icons/   ícones da PWA
```

## Princípios

- Toda consulta operacional filtra por `workspace_id` (isolamento entre tenants).
- Instantes em UTC; o fuso IANA fica no usuário e em cada registro.
- A duração nunca é armazenada: deriva de `ended_at - started_at`.
- Um único cronômetro ativo por usuário (garantido por índice único parcial).
- Exportações escrevem números reais, nunca texto.

## Licença

Ver [LICENSE](./LICENSE).
