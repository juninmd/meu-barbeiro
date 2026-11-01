# Pesquisa de mercado e prontidão SaaS

Levantamento feito em **31/10/2026** para decidir o que transforma o Meu Barbeiro de um
produto funcional em um SaaS que se vende sozinho. Preços e modelos foram conferidos
nas páginas públicas dos concorrentes e em comparativos independentes.

Fontes principais:

- Comparativo Opero, "Melhor sistema para barbearia em 2026" — <https://operosistemas.com.br/comparativo/melhor-sistema-para-barbearia-2026>
- Barbeiro.app, "7 melhores sistemas para barbearia em 2026" e comparativo de preços — <https://www.barbeiro.app/melhores-sistemas-barbearia-2026>
- GENDA, "Melhor sistema para barbearia em 2026" — <https://genda.work/melhor-sistema-para-barbearia>
- Altegio, comparativo de mercado — <https://alteg.io/pt/blog/qual-o-melhor-sistema-de-agendamento-e-gestao-do-brasil-2/>
- Atendize, comparativo de WhatsApp para barbearia — <https://atendize.com/melhor-sistema-whatsapp-barbearia.html>
- Agende-me, comparativo de sistemas — <https://agende-me.com/comparacao-sistemas-agendamento/>
- Fresha, central de ajuda sobre preços (verificado em 08/2026 pelo comparativo acima)

---

## 1. O mercado em uma página

O mercado brasileiro de software para barbearia está dividido em três modelos:

| Modelo | Exemplos | Como ganha dinheiro | Efeito no cliente |
|---|---|---|---|
| **Agenda + gestão** | Trinks, Gendo, AppBarber, Avec, Opero | Assinatura por plano ou por profissional, com módulos pagos à parte (WhatsApp, NFS-e, fidelidade) | Previsível, mas o preço sobe a cada profissional e a cada módulo |
| **Marketplace** | Booksy, Fresha, Trinks | Assinatura + taxa por cliente novo vindo do marketplace + comissão | Traz cliente novo, mas coloca a barbearia ao lado do concorrente |
| **Vertical de entrada** | GENDA, Barbeiro.app, Simples Agenda | Plano gratuito ou barato com limite de equipe; recursos avançados nos pagos | Barato para começar; o barbeiro cresce e precisa migrar de faixa |

### Preços públicos (menor plano pago)

| Plataforma | Preço de entrada | Modelo de cobrança | Teste | Observações |
|---|---|---|---|---|
| **Trinks** | R$ 110/mês (1–2 profissionais, mensal) ou R$ 76/mês no anual | Por faixa de profissionais; 3+ sob consulta | 5 dias | WhatsApp, fidelidade e lembretes cobrados à parte |
| **Booksy** | R$ 99,90/mês + R$ 20/profissional adicional | Assinatura + por assento | 14 dias | Marketplace internacional |
| **Genda** | R$ 69,90/mês (Essencial) | Por faixa de equipe; até R$ 129,90 (ilimitado) | 7 dias sem cartão | Plano grátis para 1 profissional e 50 mensagens |
| **AppBarber** | R$ 79,90/mês (1 profissional) | Por plano e faixa de equipe | 30 dias | App próprio da barbearia nas lojas |
| **Fresha** | R$ 39,95/mês (autônomo) ou R$ 26,95/profissional | Por profissional agendável + taxa por cliente novo do marketplace | — | Não é mais gratuito (correção de 08/2026) |
| **Barbeiro.app** | Grátis; Pro R$ 39,90–59,90/mês | Por faixa de equipe | Grátis permanente | Enterprise a partir de R$ 119,90–139,90 |
| **Avec** | R$ 88,90–99,90/mês (1–2 profissionais) | Por faixa; IA no WhatsApp à parte | — | NFS-e e financeiro no plano |
| **BestBarbers** | Básico grátis; app exclusivo a partir de R$ 299/mês | Assinatura + app white-label | — | Clube de assinatura é o produto principal |

**Leitura:** a faixa competitiva de entrada é **R$ 39,90 a R$ 110/mês**. Quase todos
cobram por profissional ou por faixa de equipe. O Meu Barbeiro cobrava **R$ 20/mês**,
abaixo do custo de aquisição e de suporte — insustentável e sem espaço para crescer.

### O que os concorrentes entregam e nós já tínhamos

- Agenda com horário real por profissional, fuso da barbearia, almoço, feriado e ausência.
- Link público de agendamento sem app e sem senha para o cliente.
- Sinal via Mercado Pago, estorno e status de pagamento.
- Comissão por barbeiro, fechamento do dia, produtos com estoque.
- Fidelidade, clube de assinatura do cliente, ficha do cliente.
- Fila de balcão ("dá tempo agora?"), walk-in e remarcação.
- Lembretes automáticos (Telegram) e aviso ao barbeiro.

### O que faltava para ser SaaS (e foi implementado nesta entrega)

| Lacuna | Por que impedia vender | O que foi feito |
|---|---|---|
| Cadastro self-serve | Só existia seed/DEV; ninguém conseguia assinar sem engenheiro | `/cadastro` com checagem de link em tempo real, criação da barbearia e dono automático |
| Teste grátis e bloqueio | Sem trial não há funil; sem bloqueio não há conversão | Trial de 14 dias, estados `TRIALING/ACTIVE/PAST_DUE/CANCELED/EXPIRED`, modo leitura ao vencer |
| Planos e limites | Preço único de R$ 20 e nenhum limite de equipe | Catálogo Essencial/Profissional/Escala com limite de profissionais e unidades |
| Convite de equipe | Barbeiro só entrava por seed | Convite por e-mail com token hasheado, expiração, reenvio, revogação e limite por plano |
| Onboarding | Dono caía na agenda vazia sem saber o que fazer | Checklist de 5 passos com link compartilhável e progresso |
| Cancelamento | Não havia como parar a cobrança pelo produto | Cancelamento com confirmação, chamada ao Mercado Pago e estado `CANCELED` |
| Backoffice | Operação não enxergava MRR, trials nem inadimplência | `/plataforma` com MRR, ARR, trials a vencer e ações de suporte |
| Página de vendas e preços | Não havia onde converter visitante em conta | Landing com proposta, preços, comparativo e FAQ |
| Termos e LGPD | Impedia contratar com CNPJ e anúncio | Termos de uso e política de privacidade publicados |
| Operação | Sem healthcheck de banco, logs estruturados, rate limit | `/health/ready`, logs JSON, request id, rate limit, headers, shutdown gracioso |

---

## 2. Posicionamento escolhido

**"A agenda da barbearia brasileira, sem marketplace e sem taxa por barbeiro."**

- **Contra o marketplace:** o cliente da barbearia não é lead. Booksy/Trinks/Fresha
  colocam a barbearia ao lado do concorrente e cobram por cliente originado.
- **Contra o preço por assento:** em barbearia, a equipe oscila. R$ 20 por profissional
  adicional pune justamente quem cresce.
- **A favor do Mercado Pago:** o sinal cai na conta da barbearia, não na plataforma.
  Isso reduz atrito de confiança e dispensa conta de repasse.
- **A favor do WhatsApp:** é o canal real do cliente brasileiro. O produto já tem
  lembretes; a integração oficial da Meta fica como add-on pago (custo por mensagem),
  não como dependência do plano de entrada.

## 3. Estratégia de preço

| Plano | Preço | Público | Limites |
|---|---|---|---|
| **Essencial** | R$ 49,90/mês (R$ 499/ano) | Barbeiro solo | 1 profissional, 1 unidade, 200 lembretes/mês |
| **Profissional** | R$ 89,90/mês (R$ 899/ano) | Barbearia com equipe | 5 profissionais, 1 unidade, 1.000 lembretes/mês |
| **Escala** | R$ 149,90/mês (R$ 1.499/ano) | Rede pequena | Ilimitado, 5 unidades, 5.000 lembretes/mês |

Justificativa:

1. **Entrada em R$ 49,90** fica abaixo da Trinks (R$ 110), Booksy (R$ 99,90) e
   AppBarber (R$ 79,90), e acima do Barbeiro.app gratuito — posiciona como produto
   sério, não como planilha.
2. **Anual com 2 meses grátis** melhora caixa e reduz churn, padrão do mercado.
3. **Comissão de 1% no serviço pago online** é a receita que cresce com o cliente,
   sem cobrar por assento. Continua separada da mensalidade.
4. **Assinaturas antigas ficam com o preço antigo** (`monthlyFeeCents` é o preço
   efetivo da barbearia, não o preço do catálogo). Nenhuma cobrança muda sem ação
   do dono.

### Métricas que a operação passa a acompanhar

- **MRR/ARR** por status ativo (já no backoffice).
- **Trials a vencer em 30 dias** — fila de contato comercial.
- **Conversão trial → pago**: `ACTIVE / (ACTIVE + EXPIRED + CANCELED)`.
- **Churn mensal**: cancelamentos sobre ativos no início do mês.
- **ARPA**: MRR / barbearias pagando.

## 4. Ferramentas de mercado recomendadas (e por quê)

| Necessidade | Escolha | Motivo |
|---|---|---|
| Pagamento e assinatura | **Mercado Pago** (já integrado) | Maior penetração no Brasil, preapproval para recorrência e split via `marketplace_fee` |
| Login | **Google OAuth** (já integrado) | Menor atrito para dono e barbeiro; sem senha para vazar |
| E-mail transacional | **Resend** ou webhook genérico | API simples; o código já suporta `RESEND_API_KEY` e `EMAIL_WEBHOOK_URL`, com fallback para copiar o link |
| WhatsApp | **API oficial da Meta** (fase 2) | É o canal do cliente brasileiro; custo por conversa exige add-on |
| Observabilidade | Logs JSON + `/health/ready` | Já pronto para Loki/CloudWatch e probes de Kubernetes; Sentry entra como próximo passo |
| Rate limit distribuído | Redis | Hoje é em memória (uma réplica); Redis quando escalar horizontalmente |
| Suporte | WhatsApp Business + base de ajuda | Público não abre ticket em portal |
| Analytics de produto | PostHog Cloud ou Umami | Funil de cadastro, trial e ativação sem cookie de publicidade |
| Nota fiscal | Focus NFe / eNotas (fase 2) | NFS-e é exigência para vender para CNPJ |

## 5. Riscos e decisões pendentes

1. **WhatsApp oficial**: custo por mensagem da Meta pode inviabilizar o plano de
   entrada. Decisão de negócio antes de código.
2. **NFS-e**: necessário para clientes PJ; escolher provedor e repassar custo.
3. **Multi-unidade**: o modelo é multi-tenant, mas a visão de rede (consolidado)
   ainda não existe. É o principal diferencial do plano Escala.
4. **Marketplace**: decisão consciente de não ter. Se entrar, precisa de política
   para não canibalizar a base de quem paga.
5. **Preço legado**: barbearias antigas em R$ 20/mês precisam de campanha de
   migração com prazo, não de aumento silencioso.
