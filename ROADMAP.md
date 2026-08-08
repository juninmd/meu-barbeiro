# Roadmap — Meu Barbeiro

Estado do produto e o que vem pela frente. Cada item entregue foi validado com
`tsc`, lint, testes e, quando fazia sentido, com a stack local de homologação
rodando de verdade (`local/smoke.mjs`).

As especificações completas de cada tarefa ficam em [`local/tasks/`](local/tasks/).
Os relatórios da homologação com usuários simulados ficam em `local/reports/`
(não versionado, gerado por `local/personas/run.mjs`).

---

## Como o produto é validado

Antes de qualquer coisa nesta lista existir, foi montado um ambiente que permite
provar o que se afirma:

- **Stack local em Docker** — Postgres, API, front via nginx e um **mock do
  Mercado Pago** que assina o webhook. Dá para validar pagamento de ponta a ponta
  sem conta real e sem cobrar ninguém.
- **Login mockado** (`ENABLE_DEV_LOGIN=true`, bloqueado em produção) com tela de
  escolha de conta, para entrar como qualquer perfil.
- **Homologação com usuários simulados** (`local/personas/`) — agentes navegam o
  app real com Playwright, tiram print e relatam atrito como usuário, não como
  desenvolvedor.
- **Smoke de runtime** (`local/smoke.mjs`) — 19 verificações do fluxo completo,
  incluindo pagamento, remarcação e autorização.

Foi essa homologação que encontrou o furo de autorização, o bug de fuso horário e
a maior parte dos atritos corrigidos abaixo.

---

## Entregue

### Agenda e agendamento
- **Horários realmente livres** por barbeiro, serviço e dia, no fuso da barbearia
  — no lugar do campo de data e hora em que o cliente adivinhava e só descobria o
  erro depois de enviar.
- **Correção de fuso horário**: o horário era interpretado no fuso do navegador e
  validado no fuso da barbearia. Cliente em outro fuso reservava horário errado
  sem perceber.
- **Remarcar** preservando o sinal já pago, sem novo checkout e sem estorno.
- **Cancelar** com confirmação que diz o destino do dinheiro, e prazo visível dos
  15 minutos do sinal pendente.
- **Feriados** e **intervalo de almoço** por dia da semana, bloqueando agendamento
  e sumindo da lista de horários.
- **Calendário mensal** com todos os clientes — dono enxerga todos os barbeiros,
  contratado só a própria agenda, decidido no servidor.
- **Escala e ausências por barbeiro** (folga, médico, curso). A ausência de uma
  pessoa deixou de exigir fechar a loja inteira.
- **Atendimento de balcão e telefone**, com cliente sem conta identificado por
  telefone — antes o barbeiro simplesmente não conseguia lançar na agenda quem
  ligava ou entrava na loja.
- **Registro de falta** (`NO_SHOW`), com sinal retido.
- **Repetir o último atendimento** e **"qualquer barbeiro disponível"**, que revela
  horário livre antes escondido atrás da escolha obrigatória de profissional.

### Dinheiro
- Pagamento de sinal ou valor integral via Mercado Pago, com webhook assinado.
- **Estorno automático** ao cancelar atendimento pago.
- Terminologia honesta: "Pagamento integral" quando o valor cobrado é o preço
  cheio, "Sinal" quando é parcial.
- **Produtos com estoque** — venda em transação (duas vendas do último item não
  deixam estoque negativo), preço gravado no momento da venda, produto com
  histórico não é apagado.
- **Fechamento do dia** com comissão por profissional, contando apenas atendimento
  concluído, porque agendado não é caixa.

### Relacionamento
- **Lembretes automáticos** com confirmação de presença — estava prometido no
  `AGENTS.md` e não existia; o bot era um esqueleto.
- **Ficha do cliente** (preferências, alergias, observações), presa à barbearia e
  invisível para o próprio cliente, já que é anotação interna.
- **Cartão fidelidade** configurável, com selo nascendo só em atendimento
  concluído.

### Segurança e acesso
- **Correção de autorização**: barbeiro contratado conseguia criar e excluir
  serviços, alterando catálogo e preços da barbearia. Encontrado em homologação,
  reproduzido e fechado.
- Interface por papel: contratado não vê assinatura, Mercado Pago nem
  configurações.
- Rotas de desenvolvimento (`/dev`) exigem `ENABLE_DEV_LOGIN=true` **e** ambiente
  fora de produção — o padrão é fechado.
- Nenhum valor com forma de credencial versionado: Postgres local sem senha e sem
  porta publicada, segredos sorteados a cada subida.

### Interface
- `ConfirmDialog` único com focus trap e devolução de foco, no lugar de três
  cópias.
- Cabeçalho fixo, agenda antes do formulário no mobile, favicon próprio.
- Horários agrupados em manhã, tarde e noite; expediente da barbearia visível;
  histórico com status e aviso de estorno.

### Infraestrutura
- CI verde nos quatro workflows, depois de quatro correções encadeadas que
  estavam escondidas atrás de um `startup_failure` de dois meses: permissão de
  workflow, `prisma generate` ausente, `TS2742` do pnpm e teste dependente de fuso.
- Correção de raiz no `juninmd/base-actions`: o `reusable-security-scan` declarava
  um segredo `GITHUB_TOKEN` — nome reservado que invalidava o arquivo e derrubava
  **todo** repositório que o chamasse. Substituído por binário fixado, com cache,
  verificação de checksum e auto-teste que prova a detecção.

---

## Planejado

Especificado, com critério de aceite e testes definidos.

| # | Item | Por que |
|---|---|---|
| T24 | **Navegação e mobile** | Cada funcionalidade nova empilhou conteúdo na mesma página; a rolagem que a homologação apontou piorou. Seções navegáveis com barra inferior no mobile |
| T25 | **Notificar o barbeiro** | Hoje só o cliente é avisado. Quem organiza o dia pela agenda precisa saber quando ela muda |
| T26 | **Gestão de cancelamentos** | Cancelamento não registra motivo nem antecedência; em cima da hora sai de graça e a cadeira fica vazia |
| T27 | **Atendimento na porta** | Lançar walk-in já existe; falta responder "dá tempo agora?" e organizar quem chegou primeiro |
| T28 | **Assinatura do cliente** | Cliente fixo refaz o agendamento toda vez e a barbearia não tem receita previsível |
| T29 | **Barbeiros por dia** | A regra existe no servidor, mas a lista que o cliente vê é estática: ele escolhe quem não trabalha naquele dia e só descobre no fim |
| T19 | **Comanda com vários serviços** | `Appointment` aceita **um** serviço. "Corte + barba + sobrancelha" só existe como combo pré-montado, que não escala |
| T20 | **Lista de espera** | Horário ocupado faz o cliente sumir, enquanto cancelamentos deixam cadeira vazia |
| T21 | **Avaliação pós-atendimento** | Cliente insatisfeito não reclama, só não volta |
| T22 | **Política antifalta proporcional** | A falta é contada mas não muda nada; e exigir sinal de todos afasta cliente bom |
| T23 | **Aniversário e cliente sumido** | O sistema só reage a quem aparece |

---

## Backlog

Não especificado. Ordem sugerida por valor.

- **Cupom e promoção** — desconto por campanha, primeira visita, indicação.
- **Portfólio do barbeiro** — galeria de cortes; o cliente escolhe por estilo.
- **Canal WhatsApp** — é o que o cliente brasileiro usa de verdade. Depende de
  credencial e custo da API da Meta, então é decisão de negócio antes de código.
- **Multi-unidade** — o modelo já é multi-tenant; falta a visão de rede.
- **Recibo e exportação fiscal**.
- **Comissão configurável por barbeiro** — hoje o fechamento assume regra única.

---

## Dívidas conhecidas

Registradas para não virarem surpresa.

- **Ordem das migrações**: uma migração foi criada com timestamp anterior a
  outras já existentes. Precisa ser validada em banco limpo antes de ir para
  produção.
- **Client do Prisma na imagem**: `api/prisma` é volume montado, mas o client
  gerado vive na imagem. Toda migração nova exige `prisma generate` no container
  ou rebuild — já derrubou a API local uma vez.
- **`@main` em workflow reutilizado**: mudança no repositório central quebra este
  projeto sem nenhum commit aqui. Fixar por tag ou SHA.
- **Allowlist do ruleset de segredos** não cobre host de serviço do compose
  (`@db`), só `@localhost`. Gera atrito falso em qualquer projeto com Docker.
- **Cobertura de teste do frontend** concentrada no repositório mock; os
  componentes têm pouca cobertura direta.
