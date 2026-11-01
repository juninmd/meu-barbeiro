# Prontidão SaaS — o que mudou e como provar

Esta entrega parte do produto que já existia (login unificado, aprovação de
estabelecimento, página pública, avaliações e pacotes) e fecha o que faltava para
vender e operar como SaaS: **planos, teste grátis, paywall, convite de equipe,
gestão de assinatura, backoffice de receita, agenda sem senha e páginas legais**.
A pesquisa de concorrentes está em [`market-research.md`](market-research.md).

## 1. Funil comercial

| Etapa | Rota / comportamento | Onde está |
|---|---|---|
| Aquisição | login unificado (usuário/senha e Google) com link para planos | `web/src/components/Login.tsx` |
| Interesse | página de planos com comparativo de mercado e FAQ | `web/src/features/marketing/PricingPage.tsx` (`/planos`) |
| Cadastro de conta | e-mail + senha ou Google | `POST /auth/register`, `POST /auth/login` |
| Conta aprovada | pedido de estabelecimento avaliado pelo admin | `web/src/features/account/EstablishmentOnboarding.tsx` |
| Criação | barbearia nasce em teste de 14 dias, com plano e preço efetivo | `POST /barbershops` em `api/src/routes/barbershops.routes.ts` |
| Ativação | checklist de 5 passos no topo do dia | `web/src/features/barber/OnboardingChecklist.tsx` |
| Página pública | vitrine sem login + sessão de convidado por WhatsApp | `web/src/features/public/PublicShop.tsx`, `api/src/routes/public.routes.ts` |
| Conversão | tela de assinatura com planos, checkout e cancelamento | `web/src/features/barber/SubscriptionPanel.tsx` |
| Retenção | banner de teste/limite no painel | `web/src/components/TrialBanner.tsx` |
| Operação | MRR, ARR, trials e plano por barbearia | `web/src/features/admin/RevenuePanel.tsx` |

## 2. Regras de assinatura

Catálogo em `api/src/domain/plans.ts`:

| Plano | Mensal | Anual | Profissionais | Unidades |
|---|---|---|---|---|
| Essencial | R$ 49,90 | R$ 499,00 | 1 | 1 |
| Profissional | R$ 89,90 | R$ 899,00 | 5 | 1 |
| Escala | R$ 149,90 | R$ 1.499,00 | ilimitado | 5 |

- Teste de **14 dias** criado junto com a barbearia (`trialEndsAt`).
- Estados: `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`, `EXPIRED`, `INACTIVE`.
- `monthlyFeeCents` guarda o **preço efetivo** da barbearia: assinatura antiga
  não muda de valor quando o catálogo muda.
- Ao vencer, `enforceSubscription` bloqueia escrita da equipe com
  `402 SUBSCRIPTION_REQUIRED`. Leitura, página pública, login, cobrança,
  convites e remoção de equipe continuam liberados.
- Cancelamento chama `PUT /preapproval/{id}` no Mercado Pago antes de marcar
  `CANCELED`; o webhook mantém o estado em sincronia.
- A aprovação de estabelecimento existente foi preservada: o cadastro público
  continua dependendo do administrador da plataforma.

## 3. Equipe

- `POST /barbershops/current/invitations` com papel administrador ou barbeiro.
- Token de 32 bytes aleatórios; **só o SHA-256 é gravado** (`tokenHash`).
- Validade de 7 dias, reenvio rotaciona o token, revogação imediata.
- Limite de profissionais do plano é checado antes de criar o convite.
- Aceite (`POST /invitations/:token/accept`) exige que o e-mail da conta seja o
  e-mail convidado.
- Remoção bloqueia quando há atendimento futuro (`BARBER_HAS_APPOINTMENTS`) e
  preserva histórico, comissão e relatórios.
- Toda ação sensível gera `AuditLog`.

## 4. Cliente sem senha

- `POST /public/:slug/session` cria/recupera o cliente pelo telefone e abre
  sessão, com o mesmo critério já usado no atendimento de balcão.
- Limite de 20 sessões/hora por IP e bloqueio de contas da equipe
  (`STAFF_PHONE`), para evitar que alguém entre em conta de barbeiro.
- O formulário aparece no login apenas quando a URL é de uma barbearia
  (`/b/{slug}`).
- Próximo passo de segurança: confirmar o número por código (WhatsApp/SMS).

## 5. Segurança e operação

| Controle | Implementação |
|---|---|
| Cabeçalhos de segurança | `api/src/app.ts` (`nosniff`, `DENY`, HSTS em produção, Referrer-Policy, Permissions-Policy) |
| Rate limit | login, cadastro, convites, sessão de convidado, agendamento e webhook |
| Request id | `x-request-id` aceito/gerado, presente nos logs e erros |
| Logs | JSON por evento (`api/src/lib/logger.ts`), sem corpo de requisição |
| Healthchecks | `/health/live`, `/health/ready` (consulta o banco), `/health/version` |
| Shutdown | SIGTERM/SIGINT fecham servidor, bot e Prisma com timeout de 10 s |
| CORS | allowlist por `CORS_ORIGINS` |
| Body limit | 256 kB |
| Webhook | assinatura HMAC do Mercado Pago obrigatória e evento deduplicado |
| Produção | `api/Dockerfile.prod` multi-stage, non-root, healthcheck |

## 6. Legal

- `/termos` — assinatura, teste, comissão de 1%, cancelamento, uso aceitável.
- `/privacidade` — LGPD, papéis controlador/operador, bases legais,
  compartilhamento (Google, Mercado Pago, e-mail, hospedagem), retenção,
  direitos e contato do DPO.

## 7. Como verificar

```bash
pnpm install
pnpm --filter api build        # tsc sem erros
pnpm test                      # API (node:test) + web (vitest)
pnpm lint                      # eslint com --max-warnings 0
pnpm --filter web build        # bundle de produção
```

Homologação completa (Postgres + API + nginx + Mercado Pago mock):

```bash
docker compose down -v
docker compose up -d --build
node local/smoke.mjs
```

O smoke cobre também: `/health/ready`, catálogo de planos, equipe, convite
(criação, prévia pública e revogação), onboarding, sessão de convidado, MRR no
backoffice, bloqueio por assinatura vencida e reativação.

### Evidência desta entrega

- `pnpm --filter api build`: sem erros.
- `pnpm test`: **168 testes da API** e **67 do web**, todos passando.
- `pnpm lint`: sem avisos.
- `pnpm --filter web build`: bundle gerado.
- `node local/smoke.mjs`: ver seção 8.

## 8. Resultado do smoke

Execução real em banco limpo (`docker compose down -v && docker compose up -d --build`)
seguida de `node local/smoke.mjs`:

```
All migrations have been successfully applied.   (16 migrations, incluindo as duas novas)
[seed] barbearia barbearia-central pronta com 5 usuários

PASS  api no ar
PASS  login mockado do Google
PASS  sessão do cliente
PASS  catálogo carregado :: 3 serviços, 2 barbeiros
PASS  horários disponíveis :: 42 slots, fuso America/Sao_Paulo
PASS  domingo fechado com motivo
PASS  agendar no slot oferecido :: pagamento=PENDING
PASS  pagar sinal no Mercado Pago mockado
PASS  webhook aprovou o pagamento :: valor=55 comissão=0.55
PASS  remarcar agendamento / preservou o pagamento
PASS  barbeiro contratado NÃO cria serviço :: 403
PASS  dono cria e exclui serviço
PASS  health ready responde com banco
PASS  health version exposto :: 1.2.0
PASS  assinatura e catalogo de planos :: ACTIVE Profissional
PASS  equipe carregada :: 2 membros
PASS  convite de equipe criado :: entrega=console
PASS  previa publica do convite :: Barbearia Central
PASS  convite revogado
PASS  onboarding com 5 passos :: 5/5
PASS  cliente agenda sem senha pelo link
PASS  sessao de convidado acessa a barbearia certa :: 3 servicos
PASS  login do administrador da plataforma
PASS  backoffice: MRR calculado :: MRR=8990
PASS  backoffice: carteira listada
PASS  operador coloca assinatura em atraso
PASS  paywall bloqueia escrita da equipe :: 402 SUBSCRIPTION_REQUIRED
PASS  modo leitura mantem dados visiveis
PASS  operador reativa a assinatura
PASS  escrita volta apos regularizar :: 201

TODOS OS CHECKS PASSARAM   (37/37)
```

## 9. Limites conhecidos e próximos passos

- **Identidade do cliente por telefone**: agendamento sem senha usa o WhatsApp
  como identidade, com rate limit e bloqueio de contas da equipe. O próximo passo
  é confirmação por código (WhatsApp/SMS).
- **Rate limit em memória**: com mais de uma réplica, trocar por Redis.
- **E-mail**: sem `RESEND_API_KEY`/`EMAIL_WEBHOOK_URL`, o convite é criado e o
  link aparece na tela; a UI informa que não houve entrega.
- **WhatsApp oficial e NFS-e**: decisão de negócio/custo antes do código.
- **Multi-unidade consolidada**: o plano Escala permite 5 unidades, mas ainda não
  existe visão de rede somando resultados.
