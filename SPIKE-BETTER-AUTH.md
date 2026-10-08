# Spike: Better Auth (ADR-033) — NÃO MERGEAR EM `develop`

Branch de investigação. Nada aqui vai para produção: o merge em `develop` faz deploy e a migration `0005_better_auth_spike` não deve rodar no Neon `production`.

## O que foi montado
- `src/db/auth-schema.ts` + `drizzle/0005_better_auth_spike.sql`: tabelas `ba_*` (user, session, account, verification, organization, member, invitation), geradas por `npx auth@latest generate` e só renomeadas com prefixo. Tabelas públicas do app intocadas.
- `src/server/ba/auth.ts`: `createAuth()`/`getAuth()` — Drizzle adapter `pg`, `emailOTP`, `organization` (convite por e-mail), Google/GitHub condicionais por env, hook que ativa a primeira organização no login, `nextCookies()` por último.
- `src/server/ba/context.ts`: `requireBaWorkspaceContext()` com o mesmo contrato de `requireWorkspaceContext()`; espelha em `users`/`workspaces` reutilizando os upserts de `clerk-sync.ts` (ids com prefixo `ba:` nas colunas `clerk_*`, para não migrar tabelas públicas no spike).
- `src/app/api/auth/[...all]/route.ts`, `src/lib/ba/auth-client.ts`, páginas `/spike`, `/spike/sign-in`, `/spike/accept/[id]`.
- Testes: `src/server/ba/auth.smoke.test.ts` (PGlite, Better Auth real) e `context.test.ts`.

## Como testar localmente (banco `development` do Neon!)
1. No `.env.local`: `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL=http://localhost:3000`; opcionais `RESEND_API_KEY`, `GOOGLE_*`, `GITHUB_*` (callback `http://localhost:3000/api/auth/callback/<provider>`).
2. Conferir que `DATABASE_URL` aponta para `development`; `npm run db:migrate` (ou `npx drizzle-kit migrate`).
3. `npm run dev`; abrir `/spike/sign-in`. Sem `RESEND_API_KEY`, o código e o link de convite saem no console do servidor.

## Critérios (ADR-033)
| | Critério | Estado |
|---|---|---|
| a | Login por código + Google + GitHub | Código: validado em teste (PGlite). Google/GitHub: configurado, **não testado** (precisa de credenciais OAuth) |
| b | Funciona com neon-http | Pelo código do adapter, `pg` só usa transação com `transaction: true` (desligado) → provável OK. **Não testado contra Neon** |
| c | Organizações ↔ workspaces, admin/member | Validado em teste (owner/admin → admin; member). Ponte `requireBaWorkspaceContext()` só typecheck + teste de papel; **rodar no app** |
| d | Convite por e-mail aceito por 2º usuário | Fluxo validado em teste (inclui recusa de e-mail diferente). Envio real via Resend **não testado** |
| e | Sessão lida em `getTenant()` sem mexer no resto | Contrato igual; páginas `/spike` usam a ponte. **Rodar no app** |
| f | Estimativa de migração | Ver ADR-033 (atualizado após o teste manual) |
