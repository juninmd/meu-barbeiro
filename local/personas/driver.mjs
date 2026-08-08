// Servidor de controle do navegador para as personas.
// Mantem uma pagina Playwright viva e expoe acoes HTTP simples.
// Uso: node local/personas/driver.mjs --port 7801 --persona cliente-novo [--mobile]
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const requireFromWeb = createRequire(path.join(ROOT, 'web', 'package.json'))
const playwright = await import(pathToFileURL(requireFromWeb.resolve('@playwright/test')).href)
const chromium = playwright.chromium ?? playwright.default?.chromium

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}
const flag = (name) => process.argv.includes(`--${name}`)

const PORT = Number(arg('port', 7801))
const PERSONA = arg('persona', 'persona')
const BASE = arg('base', 'http://localhost:8080')
const SHOTS = path.join(ROOT, 'local', 'reports', 'screenshots', PERSONA)

await mkdir(SHOTS, { recursive: true })

const executablePath = process.env.PLAYWRIGHT_CHROME_PATH
  || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : undefined)

const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const context = await browser.newContext({
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
  viewport: flag('mobile') ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  ...(flag('mobile') ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {}),
})
const page = await context.newPage()

const consoleErrors = []
const networkErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300))
})
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`.slice(0, 300)))
page.on('response', (response) => {
  if (response.status() >= 400) networkErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`)
})

let shotIndex = 0
const journal = []

process.on('unhandledRejection', (error) => console.error('[driver] rejeição não tratada:', error?.message))

const describe = async () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 10_000 })
      return await snapshotPage()
    } catch (error) {
      if (attempt === 2) {
        return {
          url: page.url(),
          title: '',
          text: `(não foi possível ler a página: ${error.message.split('\n')[0]})`,
          elements: [],
          consoleErrors: consoleErrors.slice(-8),
          networkErrors: networkErrors.slice(-8),
        }
      }
      await page.waitForTimeout(800)
    }
  }
}

const snapshotPage = async () => {
  const elements = await page.evaluate(() => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    }
    const label = (el) => (
      el.getAttribute('aria-label')
      || el.getAttribute('placeholder')
      || (el.labels?.[0]?.textContent ?? '')
      || el.textContent
      || el.getAttribute('name')
      || el.getAttribute('type')
      || ''
    ).replace(/\s+/g, ' ').trim().slice(0, 70)

    const out = []
    const seen = new Map()
    for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"]')) {
      if (!visible(el)) continue
      const tag = el.tagName.toLowerCase()
      const text = label(el)
      const testId = el.getAttribute('data-testid')
      const ariaLabel = el.getAttribute('aria-label')
      const visibleText = (el.textContent || '').replace(/\s+/g, ' ').trim()
      let selector
      if (testId) selector = `[data-testid="${testId}"]`
      else if (el.id) selector = `#${CSS.escape(el.id)}`
      // :has-text() casa com texto visível; se o rótulo vem do aria-label, use o atributo
      else if (ariaLabel && !visibleText.includes(ariaLabel)) {
        const same = [...document.querySelectorAll(`${tag}[aria-label="${CSS.escape(ariaLabel)}"]`)]
        selector = `${tag}[aria-label="${ariaLabel}"]`
        if (same.length > 1) selector += ` >> nth=${same.indexOf(el)}`
      }
      else if (tag === 'input' || tag === 'select' || tag === 'textarea') {
        const name = el.getAttribute('name')
        const type = el.getAttribute('type')
        if (name && (type === 'radio' || type === 'checkbox')) {
          selector = `input[name="${name}"][value="${el.value}"]`
        } else if (name) {
          selector = `${tag}[name="${name}"]`
        } else if (type) {
          const sameType = [...document.querySelectorAll(`input[type="${type}"]`)]
          const index = sameType.indexOf(el)
          selector = index <= 0 ? `input[type="${type}"]` : `input[type="${type}"] >> nth=${index}`
        } else {
          selector = `${tag} >> nth=${[...document.querySelectorAll(tag)].indexOf(el)}`
        }
      } else {
        const key = `${tag}:${text}`
        const count = (seen.get(key) ?? 0)
        seen.set(key, count + 1)
        selector = count === 0 ? `${tag}:has-text("${text}")` : `${tag}:has-text("${text}") >> nth=${count}`
      }
      out.push({
        tag,
        type: el.getAttribute('type') || undefined,
        text,
        value: 'value' in el ? String(el.value ?? '').slice(0, 60) : undefined,
        disabled: 'disabled' in el ? Boolean(el.disabled) : false,
        options: tag === 'select' ? [...el.options].map((o) => `${o.value}|${o.textContent.trim().slice(0, 50)}`) : undefined,
        selector,
      })
    }
    return out
  })

  const text = (await page.locator('body').innerText().catch(() => '')).replace(/\n{3,}/g, '\n\n').slice(0, 4000)
  return {
    url: page.url(),
    title: await page.title().catch(() => ''),
    text,
    elements,
    consoleErrors: consoleErrors.slice(-8),
    networkErrors: networkErrors.slice(-8),
  }
}

const actions = {
  async goto({ value }) {
    await page.goto(value.startsWith('http') ? value : `${BASE}${value}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(700)
  },
  async click({ selector }) {
    await page.locator(selector).first().click({ timeout: 8000 })
    await page.waitForTimeout(700)
  },
  async fill({ selector, value }) {
    await page.locator(selector).first().fill(value, { timeout: 8000 })
  },
  async select({ selector, value }) {
    await page.locator(selector).first().selectOption(value, { timeout: 8000 })
    await page.waitForTimeout(400)
  },
  async press({ selector, value }) {
    await page.locator(selector).first().press(value, { timeout: 8000 })
    await page.waitForTimeout(400)
  },
  async wait({ value }) {
    await page.waitForTimeout(Math.min(Number(value) || 1000, 8000))
  },
  async back() {
    await page.goBack({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
  },
  async shot({ value }) {
    shotIndex += 1
    const name = `${String(shotIndex).padStart(2, '0')}-${(value || 'tela').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.png`
    await page.screenshot({ path: path.join(SHOTS, name), fullPage: true })
    return { screenshot: path.posix.join('screenshots', PERSONA, name) }
  },
}

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body, null, 2))
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  if (url.pathname === '/close') {
    await writeFile(path.join(ROOT, 'local', 'reports', `${PERSONA}.journal.json`), JSON.stringify(journal, null, 2))
    json(res, 200, { closed: true, shots: shotIndex })
    setTimeout(() => { browser.close().finally(() => process.exit(0)) }, 200)
    return
  }

  const action = url.searchParams.get('action') || 'snapshot'
  const selector = url.searchParams.get('selector') || ''
  const value = url.searchParams.get('value') || ''

  try {
    let extra = {}
    if (action !== 'snapshot') {
      if (!actions[action]) return json(res, 400, { error: `Ação desconhecida: ${action}` })
      extra = (await actions[action]({ selector, value })) || {}
    }
    journal.push({ action, selector, value, url: page.url(), ...extra })
    const snapshot = action === 'shot' ? {} : await describe()
    json(res, 200, { ok: true, action, ...extra, ...snapshot })
  } catch (error) {
    journal.push({ action, selector, value, error: error.message.split('\n')[0] })
    json(res, 200, { ok: false, action, error: error.message.split('\n').slice(0, 3).join(' | '), ...(await describe()) })
  }
})

server.listen(PORT, () => console.log(`[driver:${PERSONA}] pronto na porta ${PORT} (base ${BASE})`))
