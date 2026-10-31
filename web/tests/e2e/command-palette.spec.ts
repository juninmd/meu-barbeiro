import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { loginAs } from './helpers'

test('Ctrl+K abre a paleta, navega pelo teclado e troca o tema', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await loginAs(page, 'barbeiro')

  await page.keyboard.press('Control+k')
  const dialog = page.getByRole('dialog', { name: 'Paleta de comandos' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('combobox')).toBeFocused()

  const { violations } = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(violations.map((violation) => violation.id)).toEqual([])

  await page.keyboard.type('financ')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/barbeiro\/financeiro$/)
  await expect(dialog).toBeHidden()

  await page.getByRole('button', { name: 'Buscar comandos' }).click()
  await dialog.getByRole('option', { name: 'Tema escuro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.keyboard.press('Control+k')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})
