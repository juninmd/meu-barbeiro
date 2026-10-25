# AGENTS.md - Meu Barbeiro

## Tech Stack
- **Frontend:** React 19 + Vite 6 + Tailwind CSS v4
- **Backend:** Node.js (API)
- **Deployment:** Docker + Nginx + K3s cluster
- **GitOps:** ArgoCD
- **Package Manager:** pnpm

## Project Structure
```
src/              # React frontend source
web/              # Web app entry
```

## Commands
- `pnpm install` — Install dependencies
- `pnpm --filter web dev` — Start web dev server
- `pnpm build` — Production build

## Environment Variables
- `VITE_API_URL` — Backend API URL

## Architecture
- **Frontend:** React 19 with Vite, Tailwind CSS v4 for styling
- **Deployment:** Served via Nginx on K3s cluster with ArgoCD GitOps
- **Domain:** barbeiro.antonio-code.duckdns.org

## Features
- Online appointment scheduling with unique barber link
- Service management (cuts, beard, treatments with pricing)
- Admin dashboard (daily/weekly overview, revenue tracking)
- Automatic reminders to reduce no-shows

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