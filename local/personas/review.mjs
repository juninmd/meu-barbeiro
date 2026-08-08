// Revisão pós-implementação: um agente opencode por tarefa do time codex.
// Uso: node local/personas/review.mjs [t1 t3 ...]
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const MODEL = process.env.REVIEW_MODEL || 'opencode-go/deepseek-v4-flash'
const CONCURRENCY = Number(process.env.REVIEW_CONCURRENCY || 2)
const OPENCODE_BIN = process.env.OPENCODE_BIN
  || (process.platform === 'win32' ? path.join(process.env.USERPROFILE || '', '.bun', 'bin', 'opencode.exe') : 'opencode')

const tasks = {
  t1: { titulo: 'Endpoint de horários disponíveis', arquivos: 'api/src/routes/appointments.routes.ts, api/src/lib/schedule.ts, api/src/lib/schedule.test.ts' },
  t2: { titulo: 'Seletor de data + slots no cliente e correção de fuso', arquivos: 'web/src/features/client/ClientDashboard.tsx, web/src/lib/repository.ts, web/src/types.ts, web/src/index.css' },
  t3: { titulo: 'Confirmação de cancelamento com destino do sinal e prazo do pagamento', arquivos: 'web/src/features/client/ClientDashboard.tsx, web/src/types.ts, web/src/lib/repository.ts, api/src/routes/appointments.routes.ts' },
  t4: { titulo: 'Autorização de serviços e interface por papel', arquivos: 'api/src/routes/services.routes.ts, api/src/routes/barbershops.routes.ts, web/src/features/barber/*, web/src/lib/repository.ts, web/src/types.ts' },
  t5: { titulo: 'Painel do barbeiro: métricas, timeline e confirmações', arquivos: 'web/src/features/barber/BarberDashboard.tsx, web/src/features/barber/BarbershopSettings.tsx, web/src/index.css' },
  t6: { titulo: 'Favicon, ordem mobile, cabeçalho fixo e terminologia de pagamento', arquivos: 'web/index.html, web/public/*, web/src/components/Shell.tsx, web/src/features/client/ClientDashboard.tsx, web/src/index.css' },
  t7: { titulo: 'Remarcar agendamento preservando o pagamento', arquivos: 'api/src/routes/appointments.routes.ts, web/src/features/client/ClientDashboard.tsx, web/src/lib/repository.ts' },
}

const wanted = process.argv.slice(2).filter((a) => tasks[a])
const selected = wanted.length ? wanted : Object.keys(tasks)

await mkdir(path.join(ROOT, 'local', 'reports'), { recursive: true })

const prompt = (id) => `Audite a tarefa ${id.toUpperCase()} — "${tasks[id].titulo}" — já implementada neste repositório.

A especificação original está em \`local/tasks/${id}.md\`. Leia-a primeiro.

O código não está commitado: tudo que mudou está no diff de trabalho. Comece por:
- \`git status --porcelain\`
- \`git diff -- ${tasks[id].arquivos}\`

Arquivos mais provavelmente envolvidos nesta tarefa: ${tasks[id].arquivos}
Atenção: várias tarefas mexeram nos mesmos arquivos. Julgue **apenas** o que pertence ao escopo de ${id.toUpperCase()}; mudanças de outras tarefas não são defeito desta. Se não conseguir separar, diga isso em vez de chutar.

Rode os gates que fizerem sentido para os arquivos tocados e registre a saída real:
- API: \`cd api && pnpm exec tsc --noEmit\` e \`cd api && pnpm test\`
- Web: \`cd web && pnpm exec tsc --noEmit\`, \`cd web && pnpm lint\`, \`cd web && pnpm test\`

ENTREGÁVEIS (escreva os DOIS arquivos)

1) \`local/reports/review-${id}.md\`:
# Revisão ${id.toUpperCase()} — ${tasks[id].titulo}
## Veredito
APROVADO | APROVADO COM RESSALVAS | REPROVADO — com uma frase de justificativa.
## Requisitos da especificação
Tabela: requisito | atendido (sim/não/parcial) | evidência (arquivo:linha ou saída de comando).
## Problemas encontrados
Para cada um: severidade (bloqueante/importante/menor), o que está errado, arquivo:linha, como reproduzir, correção sugerida.
## Verificações executadas
Comando e resultado real de cada gate que você rodou.
## Riscos residuais

2) \`local/reports/review-${id}.json\`:
{"tarefa":"${id}","veredito":"aprovado|ressalvas|reprovado","gates":[{"comando":"...","resultado":"passou|falhou","saida":"..."}],"problemas":[{"severidade":"bloqueante|importante|menor","titulo":"...","arquivo":"caminho:linha","descricao":"...","correcaoSugerida":"..."}]}

Se não houver problema, \`problemas\` é uma lista vazia — não invente defeito.`

const runReview = (id) => new Promise((resolve) => {
  const agent = spawn(OPENCODE_BIN, ['run', '--auto', '--agent', 'revisor', '-m', MODEL, prompt(id)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, OPENCODE_PERMISSION: '{"bash":"allow","edit":"allow","webfetch":"deny"}' },
  })
  const tag = (chunk) => String(chunk).split('\n').filter(Boolean)
    .forEach((line) => console.log(`[${id}] ${line.slice(0, 200)}`))
  agent.stdout.on('data', tag)
  agent.stderr.on('data', tag)
  agent.on('close', (code) => {
    console.log(`[${id}] revisão finalizou com código ${code}`)
    resolve(code)
  })
})

const queue = [...selected]
const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
  while (queue.length) await runReview(queue.shift())
})
await Promise.all(workers)
console.log('todas as revisões finalizaram')
process.exit(0)
