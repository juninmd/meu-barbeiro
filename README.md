<div align="center">

<img src=".github/assets/icon.svg" alt="Ícone do Meu Barbeiro: tesoura sobre fundo escuro" width="96" height="96" />

# ✂️ Meu Barbeiro

**A solução completa para gestão de barbearias e agendamentos.**<br/>
Link exclusivo para o cliente marcar horário, sinal online e lembretes automáticos.

[![Validate](https://img.shields.io/github/actions/workflow/status/juninmd/meu-barbeiro/validate.yml?branch=master&style=for-the-badge&label=validate)](https://github.com/juninmd/meu-barbeiro/actions/workflows/validate.yml)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

<br/>

<img src=".github/assets/screenshots/home.png" alt="Tela de entrada do Meu Barbeiro com o botão Continuar com Google e os acessos de desenvolvimento para cliente e barbeiro" width="860" />

</div>

> Agendamento online com link exclusivo para cada barbearia. Para ver o app em um minuto: `pnpm install && pnpm dev`.

## 📝 Descrição

O **Meu Barbeiro** é uma plataforma que simplifica a vida de barbeiros e clientes. Com agendamento online, gestão de serviços e controle financeiro, permitimos que o profissional foque no que faz de melhor: a arte da barbearia.

## 🖼️ Tour

<table>
<tr>
<td width="50%"><img src=".github/assets/screenshots/cliente-agendar.png" alt="Tela de agendamento do cliente com o próximo horário confirmado e o passo 1 de 3 de um novo agendamento" /><br/><b>Agendar</b> &ndash; o cliente vê o próximo horário e inicia um novo agendamento em três passos.</td>
<td width="50%"><img src=".github/assets/screenshots/barbeiro-hoje.png" alt="Painel do barbeiro com contadores de clientes do dia e o próximo cliente da sequência" /><br/><b>Hoje</b> &ndash; contadores do dia e o próximo cliente da fila.</td>
</tr>
</table>

<details>
<summary>🖥️ Mais telas: entrada e agenda do barbeiro</summary>

| Entrada | Agenda do barbeiro |
|---|---|
| <img src=".github/assets/screenshots/home.png" alt="Tela de entrada com acessos de desenvolvimento para cliente e barbeiro" width="420" /> | <img src=".github/assets/screenshots/barbeiro-agenda.png" alt="Agenda e disponibilidade semanal do barbeiro com horários de início e fim por dia" width="420" /> |

</details>

<sub>Capturas feitas no modo mock (`pnpm dev`) com dados fictícios.</sub>

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

> [!NOTE]
> O modo mock de `pnpm dev` não precisa de API nem de banco de dados.

Para testar contra a API real, copie `web/.env.example` para `web/.env.local`,
configure `VITE_API_URL` e defina `VITE_ENABLE_MOCKS=false`. Para iniciar web e
API juntos:

```bash
pnpm dev:full
```

## ⚙️ Configuração

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

### Variáveis de ambiente

**API** (`api/.env`):

| Variável | Propósito | Obrigatória / padrão | Exemplo |
|---|---|---|---|
| `DATABASE_URL` | conexão PostgreSQL do Prisma | obrigatória | `postgresql://usuario:senha@localhost:5432/meu_barbeiro` |
| `SESSION_SECRET` | segredo da sessão | obrigatória em `production` | 32+ caracteres aleatórios |
| `TOKEN_ENCRYPTION_KEY` | chave de 32 bytes em base64 para tokens OAuth | obrigatória para Mercado Pago | `openssl rand -base64 32` |
| `FRONTEND_URL` | origem do web (CORS e redirecionamentos) | padrão `http://localhost:5173` | `https://barbeiro.example.com` |
| `API_PUBLIC_URL` | URL pública da API (OAuth e webhook) | padrão `http://localhost:3333` | `https://api.example.com` |
| `PORT` | porta HTTP da API | padrão `3333` | `3333` |
| `DEFAULT_BARBERSHOP_SLUG` | barbearia usada quando a requisição não envia slug | padrão `barbearia-central` | `barbearia-central` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | login com Google | opcionais; sem eles o login Google fica desativado | credenciais OAuth do Google |
| `TELEGRAM_BOT_TOKEN` | liga o bot do Telegram | opcional | token fornecido pelo BotFather |
| `REMINDERS_ENABLED` | lembretes automáticos (exige `TELEGRAM_BOT_TOKEN`) | padrão `false`; só `true` liga | `false` |
| `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_CLIENT_ID`, `MERCADO_PAGO_CLIENT_SECRET`, `MERCADO_PAGO_WEBHOOK_SECRET` | credenciais da aplicação Mercado Pago | obrigatórias para cobrança e OAuth | credenciais de teste em homologação |
| `ENABLE_DEV_LOGIN` | login de desenvolvimento na API | opcional; ignorado em `production` | `true` |

**Web** (`web/.env.local`):

| Variável | Propósito | Obrigatória / padrão | Exemplo |
|---|---|---|---|
| `VITE_API_URL` | URL da API fora do modo mock | padrão `/api` | `http://localhost:3333` |
| `VITE_ENABLE_MOCKS` | acesso mock no `vite dev` | padrão ligado; `false` desliga | `false` |
| `VITE_BARBERSHOP_SLUG` | barbearia quando a URL não está no formato `/b/{slug}` | padrão `barbearia-central` | `barbearia-central` |

## 🧭 Como funciona

```mermaid
flowchart LR
  App["web/src/main.tsx<br/>React + Vite"] --> Repo["web/src/lib/repository.ts"]
  Repo -->|"mockEnabled (só vite dev)"| Local[("localStorage<br/>dados mock")]
  Repo -->|"VITE_API_URL"| Express["api/src/app.ts<br/>Express"]
  Express --> Routes["api/src/routes/*.routes.ts"]
  Routes --> Services["api/src/services/"]
  Routes --> DB[("PostgreSQL<br/>api/prisma/schema.prisma")]
  Services --> DB
  Routes --> MP["api/src/integrations/mercado-pago.ts"]
  Services --> Bot["api/src/services/telegram.service.ts"]
```

- O mock só existe em `vite dev` (`import.meta.env.DEV`): o build de produção não inclui o seletor de perfis nem os dados fictícios.
- Tokens OAuth dos vendedores são cifrados com AES-256-GCM (`api/src/lib/secrets.ts`) usando `TOKEN_ENCRYPTION_KEY`.
- Os lembretes só são agendados quando há `TELEGRAM_BOT_TOKEN` e `REMINDERS_ENABLED=true` (`api/src/server.ts`).

## ✅ Validação

Comandos de desenvolvimento, todos na raiz do repositório:

```bash
pnpm install                              # instala dependências do workspace (api e web)
pnpm dev                                  # web em http://localhost:5173 com acesso mock
pnpm dev:full                             # web e API juntos (exige PostgreSQL e api/.env)
pnpm lint                                 # ESLint do web, com zero avisos
pnpm test                                 # testes do api (tsx --test) e do web (Vitest)
pnpm build                                # tsc do api e build de produção do web
pnpm test:e2e                             # suíte Playwright, sobe o web em 127.0.0.1:5173
pnpm test:e2e:report                      # abre o relatório HTML do último run e2e
pnpm --filter api prisma:migrate:deploy   # aplica as migrations no banco de api/.env
```

## 📦 Deployment

A versão web é servida via **Nginx** no cluster **K3s**.

- **URL Web**: [https://barbeiro.antonio-code.duckdns.org](https://barbeiro.antonio-code.duckdns.org)
- **ArgoCD**: [https://argocd.antonio-code.duckdns.org](https://argocd.antonio-code.duckdns.org)

## 🤝 Contribuição

Este repositório ainda não tem guia de contribuição. Antes de mudar o código, leia o `AGENTS.md`, que descreve a stack e os comandos.

## ⚠️ Limitações conhecidas

- O modo mock guarda os dados no `localStorage` do navegador: não há sincronização entre dispositivos e ele existe apenas em `vite dev`.
- Os lembretes automáticos não enviam nada sem `TELEGRAM_BOT_TOKEN` e `REMINDERS_ENABLED=true`.
- Sinal e assinatura só funcionam com credenciais do Mercado Pago e webhook configurados na aplicação.
- As capturas de tela foram feitas no modo mock com dados fictícios.

## 📄 Licença

MIT. O arquivo `LICENSE` ainda não foi adicionado ao repositório.
