# Compasso

Aplicação web (PWA) de registro de horas. Documentos de produto, escopo e decisões (ADRs) ficam no Projeto "Compasso" no claude.ai: `escopo-mvp-v1.md` e `plano-implementacao.md`.

## Stack
Next.js (App Router, TS estrito), Tailwind, shadcn/ui, Drizzle ORM + Neon (PostgreSQL), Clerk, Zod, Vitest. Ler `AGENTS.md` e a documentação em `node_modules/next/dist/docs/` antes de usar APIs do Next.js.

## Modelo
Workspace (tenant, 1:1 com organização do Clerk) -> Organização (empresa própria ou cliente) -> Projeto -> Tarefa. Tags são do workspace. Papéis por workspace: admin | member (membro vê só as próprias horas).

## Design
Tokens, componentes e convenções estão em `design-system.md`; a referência viva fica em `/design` (oculta em produção). Usar apenas tokens (`bg-background`, `text-muted-foreground`...), nunca hex; vermelho só para cronômetro em andamento, ações destrutivas e alertas; horas sempre em `tabular-nums`.

## Regras
- Toda query operacional filtra por `workspace_id`; nunca confiar em IDs do cliente sem checar o tenant.
- Instantes em UTC (timestamptz); fuso IANA no usuário e no registro. Duração nunca é armazenada: derivar de `ended_at - started_at` (ver `src/lib/time.ts`).
- Um único timer ativo por usuário (índice único parcial).
- Valores monetários em Decimal (fora do MVP). Exportações escrevem números reais, nunca texto.
- Código em inglês, UI em português do Brasil. Validar entradas com Zod. Testes para regras de negócio.
- Migrações versionadas (`npm run db:generate`); explicar o impacto antes de alterar o schema.

## Comandos
`npm run dev | build | lint | typecheck | test | db:generate | db:migrate | db:studio`

## Fluxo de trabalho (gitflow)
- `main` = produção (só recebe `release/*` e `hotfix/*`); `develop` = integração.
- Trabalho novo: `feature/<nome>` a partir de `develop`, sempre via PR para `develop`. Nunca commitar direto em `main` ou `develop`.
- Release: `release/x.y.z` a partir de `develop` → PR para `main` + tag + merge de volta em `develop`. Correção urgente: `hotfix/*` a partir de `main`.
- Commits em Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- Antes de abrir o PR: `npm run typecheck && npm test && npm run build`; depois revisão (code-review → simplify → security-review).
