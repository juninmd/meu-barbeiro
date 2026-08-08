// Orquestra as personas: sobe um driver Playwright por persona e solta um agente
// opencode (deepseek v4) para usar o app e escrever o relatório de feedback.
// Uso: node local/personas/run.mjs [id-da-persona ...] [--rodada pos-fix]
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { personas } from './personas.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASE = process.env.APP_BASE_URL || 'http://localhost:8080'
const MODEL = process.env.PERSONA_MODEL || 'opencode-go/deepseek-v4-flash'
const CONCURRENCY = Number(process.env.PERSONA_CONCURRENCY || 3)
const OPENCODE_BIN = process.env.OPENCODE_BIN
  || (process.platform === 'win32' ? path.join(process.env.USERPROFILE || '', '.bun', 'bin', 'opencode.exe') : 'opencode')

const args = process.argv.slice(2)
const roundIndex = args.indexOf('--rodada')
const round = roundIndex === -1 ? '' : args[roundIndex + 1]
const wanted = args.filter((a, i) => !a.startsWith('--') && !(roundIndex !== -1 && i === roundIndex + 1))
const selected = wanted.length ? personas.filter((p) => wanted.includes(p.id)) : personas

const suffix = round ? `.${round}` : ''
await mkdir(path.join(ROOT, 'local', 'reports'), { recursive: true })

const waitPort = async (port, timeoutMs = 60_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ok = await fetch(`http://127.0.0.1:${port}/?action=snapshot`).then(() => true).catch(() => false)
    if (ok) return true
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

const prompt = (persona) => `TAREFA DE TESTE DE USABILIDADE. Execute agora, sem fazer perguntas e sem pedir confirmação.

Seu primeiro comando, obrigatoriamente, é:
node local/personas/act.mjs goto /

Você atua como ${persona.nome}, uma pessoa real usando o app "Meu Barbeiro".

PERFIL: ${persona.perfil}

PROIBIDO: ler ou editar o código-fonte do app (web/, api/), rodar git, ls, grep, cat, testes ou build. NÃO explore o repositório — você não é desenvolvedor, você é usuário. Sua única ferramenta é o comando act.mjs descrito abaixo, e a escrita dos dois arquivos de relatório no final.

COMO USAR O NAVEGADOR
Um Chrome real já está aberto para você. Comandos (rodar no diretório ${ROOT}, um por vez, SEM número de porta):
- node local/personas/act.mjs snapshot                   -> mostra URL, texto visível e elementos clicáveis
- node local/personas/act.mjs goto /                     -> navega (caminho do site ou URL completa)
- node local/personas/act.mjs click "<seletor>"          -> clica
- node local/personas/act.mjs fill "<seletor>" "<texto>" -> preenche campo
- node local/personas/act.mjs select "<seletor>" "<valor>"
- node local/personas/act.mjs shot <nome-do-print>       -> salva screenshot
- node local/personas/act.mjs back
Essas são as ÚNICAS ações existentes. Use SEMPRE os seletores exatos que o snapshot devolver.
Depois de cada ação a saída já traz o novo estado da tela — não precisa rodar snapshot toda hora.
Para campos de data/hora use fill com o formato "2026-08-05T15:00".

COMO ENTRAR
Na tela inicial, clique em "Continuar com Google" e escolha a conta ${persona.login} na lista.
Se por algum motivo isso falhar, use o atalho: node local/personas/act.mjs goto "/api/dev/login?email=${persona.login}"

SUA MISSÃO
${persona.missao.map((m, i) => `${i + 1}. ${m}`).join('\n')}

REGRAS
- Tire um print (shot) em cada momento importante: primeira impressão, formulário preenchido, erro que apareceu, tela do pagamento, resultado final.
- Se algo der errado, tente entender como um usuário tentaria: reler a tela, tentar outro caminho. Registre a confusão em vez de desistir em silêncio.
- Preste atenção em: clareza dos textos, o que está faltando na tela, mensagens de erro incompreensíveis, quantidade de cliques, informação escondida, preço/pagamento pouco claro, e qualquer erro de console/HTTP que aparecer no output.
- Use entre 20 e 40 comandos act.mjs. Não pare antes de tentar cumprir toda a missão.
- Ao terminar a navegação, feche: node local/personas/act.mjs close

ENTREGÁVEL (obrigatório, escreva os DOIS arquivos ao final)

1) local/reports/${persona.id}${suffix}.md com esta estrutura:
# ${persona.nome} — ${persona.id}
## Missão e o que consegui concluir
## Primeira impressão
## Atritos encontrados
Para cada atrito: título curto, severidade (alta/média/baixa), o que eu esperava, o que aconteceu, passos para reproduzir e o print correspondente.
## Erros técnicos observados
Erros de console e respostas HTTP com erro que apareceram nos snapshots.
## O que eu mudaria (em ordem de importância)
## Prints
Lista dos arquivos de print gerados.

2) local/reports/${persona.id}${suffix}.json no formato:
{"persona":"${persona.id}","concluiuMissao":true|false,"achados":[{"titulo":"...","severidade":"alta|media|baixa","area":"cliente|barbeiro|pagamento|configuracoes|responsividade|acessibilidade","oQueAconteceu":"...","impactoNoUsuario":"...","sugestao":"...","print":"screenshots/${persona.id}/xx-nome.png"}]}

Escreva em português do Brasil, na primeira pessoa, direto ao ponto. Seja honesto: se algo funcionou bem, diga; não invente defeito.

Rode agora, como primeiro comando, exatamente esta linha:
node local/personas/act.mjs goto /`

const runPersona = async (persona) => {
  const driver = spawn(process.execPath, [
    path.join(ROOT, 'local', 'personas', 'driver.mjs'),
    '--port', String(persona.port),
    '--persona', persona.id,
    '--base', BASE,
    ...(persona.mobile ? ['--mobile'] : []),
  ], { cwd: ROOT, stdio: 'ignore' })

  try {
    if (!await waitPort(persona.port)) throw new Error(`driver da persona ${persona.id} não subiu`)
    console.log(`[${persona.id}] navegador pronto na porta ${persona.port}`)

    const code = await new Promise((resolve) => {
      const agent = spawn(OPENCODE_BIN, ['run', '--auto', '--agent', 'persona', '-m', MODEL, prompt(persona)], {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PERSONA_PORT: String(persona.port),
          OPENCODE_PERMISSION: '{"bash":"allow","edit":"allow","webfetch":"allow"}',
        },
      })
      const tag = (chunk) => String(chunk).split('\n').filter(Boolean)
        .forEach((line) => console.log(`[${persona.id}] ${line.slice(0, 200)}`))
      agent.stdout.on('data', tag)
      agent.stderr.on('data', tag)
      agent.on('close', resolve)
    })
    console.log(`[${persona.id}] agente finalizou com código ${code}`)
  } catch (error) {
    console.error(`[${persona.id}] falhou: ${error.message}`)
  } finally {
    await fetch(`http://127.0.0.1:${persona.port}/close`).catch(() => {})
    setTimeout(() => driver.kill(), 3000)
  }
}

const queue = [...selected]
const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
  while (queue.length) {
    const persona = queue.shift()
    await runPersona(persona)
  }
})
await Promise.all(workers)
console.log('todas as personas finalizaram')
process.exit(0)
