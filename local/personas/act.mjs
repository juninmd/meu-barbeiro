// CLI do agente-persona. Fala com o driver.mjs (porta vem de PERSONA_PORT).
// Uso:
//   node local/personas/act.mjs snapshot
//   node local/personas/act.mjs goto /
//   node local/personas/act.mjs click "<seletor>"
//   node local/personas/act.mjs fill "<seletor>" "<valor>"
//   node local/personas/act.mjs select "<seletor>" "<valor>"
//   node local/personas/act.mjs shot <nome-do-print>
//   node local/personas/act.mjs back | close
const ACTIONS = ['snapshot', 'goto', 'click', 'fill', 'select', 'press', 'wait', 'back', 'shot', 'close']
const NEEDS_SELECTOR = ['click', 'fill', 'select', 'press']

const help = () => console.log([
  'Ações válidas: ' + ACTIONS.join(', '),
  'Exemplos:',
  '  node local/personas/act.mjs snapshot',
  '  node local/personas/act.mjs goto /',
  '  node local/personas/act.mjs click "button:has-text(\\"Solicitar agendamento\\")"',
  '  node local/personas/act.mjs fill "input[type=\\"datetime-local\\"]" "2026-08-05T15:00"',
  '  node local/personas/act.mjs shot tela-inicial',
].join('\n'))

const port = process.env.PERSONA_PORT
if (!port) {
  console.log('PERSONA_PORT não definida no ambiente — este comando só funciona dentro da sessão da persona.')
  process.exit(0)
}

const [action = 'snapshot', a = '', b = ''] = process.argv.slice(2)
if (!ACTIONS.includes(action)) {
  console.log(`Ação "${action}" não existe. Nada foi feito no navegador.`)
  help()
  process.exit(0)
}

const params = new URLSearchParams({ action })
if (NEEDS_SELECTOR.includes(action)) {
  params.set('selector', a)
  params.set('value', b)
} else if (a) {
  params.set('value', a)
}

const path = action === 'close' ? '/close' : `/?${params}`
const response = await fetch(`http://127.0.0.1:${port}${path}`).catch((error) => {
  console.log(`Navegador da sessão não respondeu: ${error.message}`)
  process.exit(0)
})

const raw = await response.text()
let body
try {
  body = JSON.parse(raw)
} catch {
  console.log(`Resposta inesperada do navegador: ${raw.slice(0, 200)}`)
  process.exit(0)
}

if (body.error) console.log(`ERRO: ${body.error}`)
if (body.screenshot) console.log(`PRINT: ${body.screenshot}`)
if (body.url) console.log(`URL: ${body.url}`)
if (body.consoleErrors?.length) console.log(`ERROS DE CONSOLE:\n- ${body.consoleErrors.join('\n- ')}`)
if (body.networkErrors?.length) console.log(`RESPOSTAS HTTP COM ERRO:\n- ${body.networkErrors.join('\n- ')}`)
if (body.text) console.log(`\nTEXTO VISIVEL:\n${body.text}`)
if (body.elements?.length) {
  console.log('\nELEMENTOS INTERATIVOS:')
  for (const el of body.elements) {
    const bits = [el.selector, `[${el.tag}${el.type ? `:${el.type}` : ''}]`, el.text && `"${el.text}"`]
    if (el.value) bits.push(`valor="${el.value}"`)
    if (el.disabled) bits.push('DESABILITADO')
    if (el.options) bits.push(`opcoes=${el.options.join(' ; ')}`)
    console.log(`- ${bits.filter(Boolean).join(' ')}`)
  }
}
if (body.closed) console.log(`sessao encerrada (${body.shots} prints)`)
