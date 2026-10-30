# Comparativo com o AppBarber

> **Limite da fonte.** A página pedida (`sites.appbarber.com.br/housebarbearia-gqci`) respondeu **HTTP 429** (bloqueio de acesso
> automatizado) e não pôde ser lida; buscas públicas também não a indexam. Este comparativo usa o que **está publicado na ficha do
> app AppBarber na App Store** ("Agendamentos online via Webadmin e App; Caixa; Financeiro; Gestão de Pacotes; Gestão de Estoque;
> Programa de Fidelidade; Pesquisa de Satisfação") e o que dá para inferir do endereço do link (`source=google_reserve`: o cliente
> chega por *Reservar com o Google*). Itens que dependem de ver a página (layout, textos, ordem do fluxo) **não** foram avaliados.

## Matriz de funcionalidades

| Funcionalidade (AppBarber) | Meu Barbeiro antes | Meu Barbeiro agora |
|---|---|---|
| Agendamento online (web + app) | ✅ fluxo em 3 passos, "qualquer barbeiro", remarcar, repetir último | ✅ + calendário pt-BR; app instalável (PWA) |
| **Página/site público da barbearia** | ❌ exigia login para ver qualquer coisa | ✅ **`/b/{slug}` público**: serviços e preços, equipe, horários com "aberto agora", avaliações, como chegar, compartilhar |
| **Pesquisa de satisfação** | ❌ | ✅ **avaliação 1–5 + comentário** após atendimento concluído; média e distribuição na página pública; painel de avaliações para a equipe (contratado vê só as suas) |
| Divulgação do link | ❌ | ✅ **cartão "Seu link de agendamento"**: copiar, WhatsApp, ver página e **QR Code** para o balcão |
| Caixa / Financeiro | ✅ fechamento diário, receita, comissão, cancelamentos | ✅ (já existia) |
| Gestão de estoque | ✅ produtos, entradas, vendas, alerta de baixo estoque | ✅ (já existia) |
| Programa de fidelidade | ✅ cartão com selos e recompensa | ✅ (já existia) |
| Gestão de pacotes | 🟡 *Clube* (assinatura recorrente com visitas incluídas) | 🟡 igual — **pacote pré-pago de N sessões avulsas** não existe |
| Lembretes / avisos | ✅ Telegram (cliente e equipe) | ✅ (já existia) |
| Reservar com o Google | ❌ | ❌ exige ser parceiro Google (processo comercial/feed); fora do alcance só de código |

Diferenciais que o Meu Barbeiro já tinha e a ficha pública do concorrente não cita: sinal/pagamento via Mercado Pago com comissão
transparente, política de cancelamento com retenção, fila de chegada (balcão), horários recorrentes, escala e ausências por barbeiro,
multi-barbearia com aprovação do administrador, tema escuro, acessibilidade auditada (axe, WCAG AA).

## Entregue nesta rodada
1. Página pública da barbearia (`GET /barbershops/current/profile`, sem login) e `PublicShop`.
2. Avaliações: tabela `Review` (migração `20260905000000_reviews`), `POST /reviews`, `GET /reviews/mine`, `GET /reviews` (equipe),
   regras no servidor (só o próprio cliente, só atendimento `DONE`, uma vez por atendimento, nota 1–5).
3. Cartão de link + QR Code em Ajustes.
4. Testes: API (regras de avaliação, resumo), vitest (mock e horário "aberto agora"), e2e (página pública, fluxo de avaliação ponta a ponta,
   link/QR) e axe (página pública em claro/escuro, desktop/celular).

## Próximos passos sugeridos (não implementados)
- **Pacotes pré-pagos** (ex.: 5 cortes por R$ X, validade, saldo por cliente).
- **Reservar com o Google** (parceria Google; a página pública e os dados estruturados já ajudam).
- Fotos de serviços/equipe e galeria na página pública; resposta da barbearia às avaliações; avaliação por profissional na página.
- Se puder, cole o HTML/texto da página do concorrente: refaço este comparativo com base no que ela realmente mostra.
