import { expect, type Locator, type Page, test } from '@playwright/test'

const fixedNow = new Date('2026-07-17T12:00:00-03:00')

async function openCleanApp(page: Page) {
  await page.clock.setFixedTime(fixedNow)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
}

async function loginAs(page: Page, role: 'cliente' | 'barbeiro') {
  await page.getByRole('button', { name: new RegExp(`Visão ${role}`, 'i') }).click()
}

async function expectMinimumTouchTarget(locator: Locator) {
  const box = await locator.boundingBox()
  expect(box, 'o alvo de toque precisa estar visível').not.toBeNull()
  expect(box!.width, 'largura mínima do alvo de toque').toBeGreaterThanOrEqual(44)
  expect(box!.height, 'altura mínima do alvo de toque').toBeGreaterThanOrEqual(44)
}

async function expectNoHorizontalScroll(page: Page) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 5)
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}:${Math.round(element.getBoundingClientRect().right)}`),
  }))
  expect(result.scrollWidth, `elementos fora da viewport: ${result.offenders.join(', ')}`).toBeLessThanOrEqual(390)
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openCleanApp(page)
})

test('prioriza o próximo horário acima do formulário do cliente', async ({ page }) => {
  await loginAs(page, 'cliente')
  await expect(page).toHaveURL(/\/cliente\/horarios$/)
  await page.getByRole('link', { name: 'Agendar', exact: true }).click()

  const nextBox = await page.getByTestId('client-next-appointment').boundingBox()
  const bookingBox = await page.getByTestId('booking-form').boundingBox()
  expect(nextBox).not.toBeNull()
  expect(bookingBox).not.toBeNull()
  expect(nextBox!.y).toBeLessThan(bookingBox!.y)
})

test('navega por todas as seções do barbeiro sem rolagem horizontal e mantém histórico', async ({ page }) => {
  await loginAs(page, 'barbeiro')
  await expect(page).toHaveURL(/\/barbeiro\/hoje$/)
  const nextClientBox = await page.getByRole('region', { name: 'Próximo cliente' }).boundingBox()
  const barberNavigationBox = await page.getByRole('navigation', { name: 'Navegação principal' }).boundingBox()
  expect(nextClientBox).not.toBeNull()
  expect(barberNavigationBox).not.toBeNull()
  expect(nextClientBox!.y + nextClientBox!.height, 'resumo de hoje deve caber antes da barra inferior').toBeLessThanOrEqual(barberNavigationBox!.y)

  for (const destination of ['Agenda', 'Clientes', 'Produtos']) {
    await page.getByRole('link', { name: destination, exact: true }).click()
    await expect(page.locator('main')).toHaveAttribute('data-section', destination.toLowerCase())
    await expectNoHorizontalScroll(page)
  }

  await page.getByRole('button', { name: 'Mais' }).click()
  await page.getByRole('link', { name: 'Financeiro' }).click()
  await expect(page.locator('main')).toHaveAttribute('data-section', 'financeiro')
  await expectNoHorizontalScroll(page)

  await page.getByRole('button', { name: 'Mais' }).click()
  await page.getByRole('link', { name: 'Ajustes' }).click()
  await expect(page.locator('main')).toHaveAttribute('data-section', 'ajustes')
  await page.goBack()
  await expect(page.locator('main')).toHaveAttribute('data-section', 'financeiro')
  await page.reload()
  await expect(page.locator('main')).toHaveAttribute('data-section', 'financeiro')
})

test('barra inferior não cobre ação principal e alvos principais medem 44px', async ({ page }) => {
  await loginAs(page, 'cliente')
  await page.getByRole('link', { name: 'Agendar', exact: true }).click()

  const primaryAction = page.getByRole('button', { name: 'Continuar' })
  const bottomNavigation = page.getByRole('navigation', { name: 'Navegação principal' })
  const actionBox = await primaryAction.boundingBox()
  const navigationBox = await bottomNavigation.boundingBox()
  expect(actionBox).not.toBeNull()
  expect(navigationBox).not.toBeNull()
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(navigationBox!.y)

  await expectMinimumTouchTarget(primaryAction)
  await expectMinimumTouchTarget(page.getByRole('link', { name: 'Agendar', exact: true }))
  await expectMinimumTouchTarget(page.getByRole('link', { name: 'Meus horários' }))
  await expectMinimumTouchTarget(page.getByRole('link', { name: 'Perfil' }))
})

test('contratado não vê nem acessa Financeiro e Ajustes', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('meu-barbeiro:mock-state:v2', JSON.stringify({
    barbershop: { membershipRole: 'BARBER' },
  })))
  await loginAs(page, 'barbeiro')

  await expect(page.getByRole('link', { name: 'Financeiro' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Ajustes' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mais' })).toHaveCount(0)

  await page.goto('/barbeiro/financeiro')
  await expect(page).toHaveURL(/\/barbeiro\/hoje$/)
  await expect(page.locator('main')).toHaveAttribute('data-section', 'hoje')
})
