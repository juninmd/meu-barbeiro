import { expect, test } from '@playwright/test'

test('customer books and barber confirms the same appointment', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.getByRole('button', { name: /Visão cliente/i }).click()
  await expect(page.getByRole('heading', { name: 'Reserve sua cadeira.' })).toBeVisible()

  await page.getByText('Corte assinatura', { exact: true }).click()
  await page.getByRole('group', { name: /Com quem/ }).getByText('Rafael Navalha', { exact: true }).click()

  const appointmentDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
  while ([0, 1].includes(appointmentDate.getDay())) appointmentDate.setDate(appointmentDate.getDate() + 1)
  appointmentDate.setHours(11, 0, 0, 0)
  const localDate = new Date(appointmentDate.getTime() - appointmentDate.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
  await page.getByLabel('Data e horário').locator('..').getByRole('textbox').fill(localDate)
  await page.getByRole('button', { name: /Solicitar agendamento/i }).click()

  await expect(page.getByText(/Pedido enviado/)).toBeVisible()
  await expect(page.getByText('Corte assinatura', { exact: true })).toHaveCount(2)

  await page.getByLabel('Trocar perfil mock').selectOption('BARBER')
  await expect(page.getByRole('heading', { name: 'Agenda de atendimento' })).toBeVisible()

  const appointment = page.locator('article').filter({ hasText: 'Marina Costa' }).last()
  await expect(appointment).toContainText('Aguardando')
  await appointment.getByRole('button', { name: 'Confirmar' }).click()
  await expect(appointment).toContainText('Confirmado')

  await page.getByLabel('Trocar perfil mock').selectOption('CUSTOMER')
  await expect(page.locator('article').filter({ hasText: 'Corte assinatura' }).last()).toContainText('Confirmado')
})
