import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { loginAs, signOut } from './helpers'

// Os percursos passam por muitas telas em dois temas: precisam de mais tempo que o padrão de 30s.
test.describe.configure({ timeout: 150_000 })

// Auditoria automática (axe, WCAG 2.1 A/AA) das telas principais nos dois temas: contraste, nomes acessíveis, rótulos, landmarks.
const fixedNow = new Date('2026-07-17T12:00:00-03:00')

async function audit(page: Page, name: string) {
  // O axe mede contraste com a opacidade atual: espera a transição de entrada da página terminar.
  const transition = page.getByTestId('route-transition')
  if (await transition.count()) await expect(transition).toHaveCSS('opacity', '1')
  await page.waitForTimeout(150)
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const summary = violations.map((violation) => `${violation.id} (${violation.impact}): ${violation.nodes.slice(0, 3).map((node) => node.target.join(' ')).join(' | ')}`)
  expect(summary, `${name}: violações de acessibilidade`).toEqual([])
}

for (const scheme of ['light', 'dark'] as const) {
  test(`acessibilidade (${scheme}): login, cliente, barbeiro e admin`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme, locale: 'pt-BR', viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.clock.setFixedTime(fixedNow)
    await page.goto('/')
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible()
    await audit(page, `${scheme} login`)

    await loginAs(page, 'cliente')
    await audit(page, `${scheme} cliente/horarios`)
    await page.getByRole('link', { name: 'Agendar', exact: true }).click()
    await audit(page, `${scheme} cliente/agendar`)
    await page.getByRole('link', { name: 'Perfil' }).click()
    await audit(page, `${scheme} cliente/perfil`)
    await page.getByRole('button', { name: 'Menu da conta' }).click()
    await page.getByRole('menuitem', { name: 'Design system' }).click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await audit(page, `${scheme} design-system`)
    await signOut(page)

    await loginAs(page, 'barbeiro')
    for (const section of ['Hoje', 'Agenda', 'Clientes', 'Produtos', 'Financeiro', 'Ajustes']) {
      await page.getByRole('link', { name: section, exact: true }).click()
      await audit(page, `${scheme} barbeiro/${section}`)
    }
    await signOut(page)

    await loginAs(page, 'admin')
    await audit(page, `${scheme} admin/visao`)
    await page.getByRole('link', { name: 'Liberações' }).first().click()
    await audit(page, `${scheme} admin/liberacoes`)
    await context.close()
  })
}

for (const scheme of ['light', 'dark'] as const) {
  test(`acessibilidade no celular (${scheme}): agendamento, agenda e ajustes`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme, locale: 'pt-BR', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.clock.setFixedTime(fixedNow)
    await page.goto('/')
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
    await page.reload()
    await audit(page, `${scheme} mobile login`)

    await loginAs(page, 'cliente')
    await page.getByRole('link', { name: 'Agendar', exact: true }).click()
    await page.getByRole('radio', { name: /Corte assinatura/ }).check()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await audit(page, `${scheme} mobile agendar/data`)
    await signOut(page)

    await loginAs(page, 'barbeiro')
    await page.getByRole('link', { name: 'Agenda', exact: true }).click()
    await audit(page, `${scheme} mobile barbeiro/agenda`)
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByRole('link', { name: 'Ajustes' }).click()
    await audit(page, `${scheme} mobile barbeiro/ajustes`)
    await context.close()
  })
}

for (const scheme of ['light', 'dark'] as const) {
  for (const [label, viewport] of [['desktop', { width: 1280, height: 900 }], ['celular', { width: 390, height: 844 }]] as const) {
    test(`acessibilidade da página pública (${scheme}, ${label})`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme: scheme, locale: 'pt-BR', viewport, isMobile: label === 'celular', reducedMotion: 'reduce' })
      const page = await context.newPage()
      await page.clock.setFixedTime(fixedNow)
      await page.goto('/b/barbearia-central')
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
      await page.reload()
      await expect(page.getByRole('heading', { level: 1, name: 'Barbearia Central' })).toBeVisible()
      await audit(page, `${scheme} ${label} página pública`)
      await context.close()
    })
  }
}
