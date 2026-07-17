# ✂️ Meu Barbeiro

> A solução completa para gestão de barbearias e agendamentos.

[![Deployment Status](https://img.shields.io/badge/ArgoCD-Synced-success?style=for-the-badge&logo=argocd)](https://argocd.antonio-code.duckdns.org)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

## 📝 Descrição

O **Meu Barbeiro** é uma plataforma que simplifica a vida de barbeiros e clientes. Com agendamento online, gestão de serviços e controle financeiro, permitimos que o profissional foque no que faz de melhor: a arte da barbearia.

## ✨ Funcionalidades

- **Agendamento Online**: Link exclusivo para clientes marcarem horário.
- **Gestão de Serviços**: Cadastro de cortes, barbas e tratamentos com preços e durações.
- **Painel Administrativo**: Visão geral do dia, semana e faturamento.
- **Notificações**: Lembretes automáticos para evitar faltas.
- **SaaS multi-barbearia**: identidade, endereço, horários e política de sinal por estabelecimento.
- **Mercado Pago**: assinatura mensal de R$ 20,00, conexão OAuth do vendedor, sinal online e comissão fixa de 1% por serviço.

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/) + [Vite 6](https://vite.dev/)
- **Backend**: Node.js (API)
- **Estilização**: Tailwind CSS v4
- **Deployment**: Nginx + Docker

## 🚀 Como Rodar Localmente

1. Clone o repositório:
   ```bash
   git clone https://github.com/juninmd/meu-barbeiro.git
   ```
2. Instale as dependências:
   ```bash
   pnpm install
   ```
3. Inicie o web app em modo de desenvolvimento:
   ```bash
   pnpm dev
   ```

O modo de desenvolvimento abre uma área **Acesso mock**. Use **Visão cliente**
para criar e cancelar agendamentos e **Visão barbeiro** para confirmar horários,
concluir atendimentos e gerenciar serviços. Os dados ficam no `localStorage` do
navegador. O seletor de perfis e os dados mock não são habilitados no build de
produção.

Para testar contra a API real, copie `web/.env.example` para `web/.env.local`,
configure `VITE_API_URL` e defina `VITE_ENABLE_MOCKS=false`. Para iniciar web e
API juntos:

```bash
pnpm dev:full
```

### API, banco e Mercado Pago

Copie `api/.env.example` para `api/.env` e configure PostgreSQL, sessão, Google e
Mercado Pago. Gere `SESSION_SECRET` e `TOKEN_ENCRYPTION_KEY` com valores aleatórios;
tokens OAuth dos vendedores são persistidos criptografados.

Banco novo:

```bash
pnpm --filter api prisma:migrate:deploy
```

Banco legado já criado antes do Prisma Migrate: confira que ele corresponde ao
schema inicial, marque somente a baseline e depois aplique as demais migrations:

```bash
pnpm --filter api exec prisma migrate resolve --applied 20260717000000_initial
pnpm --filter api prisma:migrate:deploy
```

Na aplicação do Mercado Pago, configure:

- Redirect OAuth: `${API_PUBLIC_URL}/billing/mercado-pago/callback`
- Webhook: `${API_PUBLIC_URL}/billing/mercado-pago/webhook`
- Eventos: `payment` e `subscription_preapproval`

Use credenciais de teste em homologação e credenciais de produção somente nos
Secrets do ambiente. A plataforma cobra R$ 20,00/mês da barbearia. Em cada
checkout do cliente, `marketplace_fee` recebe 1% do valor total do serviço; o
sinal configurado precisa ser suficiente para essa comissão.

## ✅ Validação

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

## 📦 Deployment

A versão web é servida via **Nginx** no cluster **K3s**.

- **URL Web**: [https://barbeiro.antonio-code.duckdns.org](https://barbeiro.antonio-code.duckdns.org)
