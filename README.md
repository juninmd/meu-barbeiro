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
