import { expect, type Page, test } from '@playwright/test'
import { loginAs, signIn, signOut } from './helpers'

const fixedNow = new Date('2026-07-17T12:00:00-03:00')

async function openPublic(page: Page) {
  await page.clock.setFixedTime(fixedNow)
  await page.goto('/b/barbearia-central')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Barbearia Central' })).toBeVisible()
}

test('página pública mostra serviços, equipe, horários e avaliações sem login', async ({ page }) => {
  await openPublic(page)
  await expect(page.getByRole('heading', { name: 'Serviços' })).toBeVisible()
  await expect(page.getByText('Corte assinatura')).toBeVisible()
  await expect(page.getByText('R$ 55,00')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Equipe' })).toBeVisible()
  await expect(page.getByText('Rafael Navalha')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Horário de funcionamento' })).toBeVisible()
  await expect(page.getByText('almoço 12:00–13:00').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'O que dizem os clientes' })).toBeVisible()
  await expect(page.getByText('Melhor degradê da região.')).toBeVisible()
  await expect(page.getByText('4.7', { exact: false }).first()).toBeVisible()
  // 17/07/2026 12:00 em São Paulo é sexta, dentro do almoço
  await expect(page.getByText('Pausa para o almoço, volta às 13:00')).toBeVisible()
})

test('agendar na página pública leva ao login e permite voltar', async ({ page }) => {
  await openPublic(page)
  await page.getByRole('button', { name: 'Agendar horário' }).first().click()
  await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible()
  await page.getByRole('button', { name: 'Voltar para a barbearia' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Barbearia Central' })).toBeVisible()
  await page.getByRole('button', { name: 'Agendar horário' }).first().click()
  await signIn(page, 'marina@demo.local', 'demo1234')
  await expect(page).toHaveURL(/\/cliente\//)
})

test('cliente avalia atendimento concluído; nota aparece na página pública e no painel do barbeiro', async ({ page }) => {
  await page.clock.setFixedTime(fixedNow)
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()

  // barbeiro conclui o atendimento da Marina
  await loginAs(page, 'barbeiro')
  await page.getByRole('link', { name: 'Agenda', exact: true }).click()
  const card = page.locator('article').filter({ hasText: 'Marina Costa' }).first()
  await card.getByRole('button', { name: 'Concluir' }).click()
  await expect(card).toContainText('Concluído')
  await signOut(page)

  // cliente avalia (sem horário futuro, o app abre direto em "Agendar")
  await signIn(page, 'marina@demo.local', 'demo1234')
  await expect(page).toHaveURL(/\/cliente\//)
  await page.getByRole('link', { name: 'Meus horários' }).click()
  await page.getByText(/Ver histórico/).click()
  await page.getByRole('button', { name: 'Avaliar atendimento' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Enviar avaliação' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Escolha uma nota')
  await dialog.getByRole('radio', { name: /5 estrelas/ }).click()
  await dialog.getByLabel('Comentário (opcional)').fill('Atendimento impecável, voltarei sempre.')
  await dialog.getByRole('button', { name: 'Enviar avaliação' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Sua avaliação')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Avaliar atendimento' })).toHaveCount(0)
  await signOut(page)

  // painel do barbeiro e página pública refletem a nota
  await loginAs(page, 'barbeiro')
  await page.getByRole('link', { name: 'Clientes', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Avaliações dos clientes' })).toBeVisible()
  await expect(page.getByText('Atendimento impecável, voltarei sempre.')).toBeVisible()
  await expect(page.getByText('4 avaliações')).toBeVisible()
  await signOut(page)
  await page.goto('/b/barbearia-central')
  await expect(page.getByText('Atendimento impecável, voltarei sempre.')).toBeVisible()
})

test('dono copia o link de agendamento e vê o QR Code em Ajustes', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await loginAs(page, 'barbeiro')
  await page.getByRole('link', { name: 'Ajustes' }).click()
  const card = page.getByRole('region', { name: 'Seu link de agendamento' })
  await expect(card.getByLabel('Link de agendamento')).toHaveValue(/\/b\/barbearia-central$/)
  await expect(card.locator('canvas')).toBeVisible()
  await card.getByRole('button', { name: 'Copiar link' }).click()
  await expect(page.getByText('Link copiado.')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/b\/barbearia-central$/)
})
