# Homologação visual E2E

Os testes executam todas as funcionalidades disponíveis no frontend mock e
anexam 32 screenshots ao relatório HTML do Playwright.

## Executar

```bash
pnpm test:e2e
pnpm test:e2e:report
```

No Linux/CI, instale o navegador uma vez com
`pnpm --filter web exec playwright install --with-deps chromium`. Para usar um
Chrome já instalado, defina `PLAYWRIGHT_CHROME_PATH` com o caminho do binário.

Artefatos:

- `web/test-results/e2e/`: screenshots por cenário.
- `web/playwright-report/`: relatório HTML com cada screenshot anexado.

## Matriz de cobertura visual

| Área | Funcionalidades registradas |
| --- | --- |
| Acesso | Login, acessos mock, troca cliente/barbeiro e logout |
| Cliente | Agenda inicial, seleção de serviço/barbeiro/data, criação, conflito, expediente, cancelamento, estado vazio e histórico |
| Barbeiro | Dashboard, métricas, confirmação, conclusão e cancelamento |
| Serviços | Catálogo, formulário, cadastro, exclusão e bloqueio por agendamento ativo |
| SaaS | Mensalidade de R$ 20, assinatura inativa/ativa e comissão de 1% |
| Mercado Pago | Conta conectada, desconexão e reconexão OAuth simulada |
| Personalização | Nome, cor, endereço, horários e política de sinal por barbearia |
| Responsividade | Login, visão cliente e visão barbeiro em 390×844 |

O relógio do navegador é fixado em `2026-07-17 12:00 America/Sao_Paulo` para
que textos, horários, dados mock e screenshots sejam reproduzíveis.
