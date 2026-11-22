# AGENTS.md

Meu Barbeiro: online appointment scheduling for barbers, with a unique booking link per barber, services and prices, an admin dashboard (daily and weekly view, revenue) and automatic reminders to reduce no-shows. pnpm monorepo: `api/` (Node, Prisma) and `web/` (React).

## Stack

- Web: React 19, Vite 6, Tailwind CSS v4, TypeScript, Playwright (e2e)
- API: Node.js, Prisma (`api/prisma/schema.prisma`, `api/prisma/migrations/`)
- Deploy: Docker, Nginx, K3s, ArgoCD (`deploy/k8s/api.yaml`, `docs/DEPLOY.md`)
- Package manager: pnpm (`pnpm-lock.yaml`, `pnpm-workspace.yaml`)

## Commands

```bash
pnpm install                       # postinstall runs prisma generate
pnpm dev                           # web dev server
pnpm dev:full                      # api and web together
pnpm build                         # build api and web
pnpm lint                          # web eslint, zero warnings allowed
pnpm test                          # api (tsx --test) and web (vitest)
pnpm test:e2e                      # web Playwright suite
pnpm --filter api prisma:migrate   # dev migration (creates a new migration)
pnpm --filter api prisma:migrate:deploy
pnpm --filter api exec tsx src/seed.ts
```

## Structure

- `api/src/domain/` - business rules (plans, scheduling); `api/src/routes/` - HTTP routes; `api/src/server.ts` - entry point
- `api/prisma/` - schema and migrations
- `web/src/lib/` - client helpers (plans, API access); web UI in `web/src/`
- `deploy/k8s/` - Kubernetes manifests synced by ArgoCD
- `docs/` - deploy and project docs
- `local/` - dev harness: mock payment server, smoke script, persona runner, and task specs (`local/tasks/t*.md`)
- `.opencode/agent/` - OpenCode agent configs (persona, reviewer)

## Conventions

- Web lint runs with `--max-warnings 0`; fix warnings, do not raise the limit.
- API tests use `node --test` through `tsx`; web unit tests use Vitest on `web/src`.
- Schema changes need a migration in `api/prisma/migrations/`; run `prisma:migrate:deploy` in CI, never edit an applied migration.

<!-- base-actions-main-policy -->
## GitHub Actions — padrão obrigatório (@main)

- Referencie as actions internas sempre pelo branch, nunca por SHA:
  - `uses: juninmd/base-actions/<action>@main`
  - `uses: juninmd/base-actions/.github/workflows/<arquivo>.yml@main`
- Não fixe `@<sha>` em `juninmd/base-actions`: a atualização é centralizada no
  `main` e passa a valer no próximo run.
- PRs cujos checks não iniciam por billing/spending limit são mesclados pelo bot central
  `juninmd/base-actions/.github/workflows/auto-merge-billing-blocked.yml`.
  Para impedir o merge automático de um PR, aplique a label `do-not-merge`.

## Gotchas

- Env vars (names only): API `DATABASE_URL`, `PORT`, `TELEGRAM_BOT_TOKEN`; web `VITE_API_URL` (backend URL). Copy from `.env.example`; never commit real values.
- Docker image builds on push to `master` (`docker-build.yml`).
- Production domain: barbeiro.antonio-code.duckdns.org (served by Nginx on K3s).
