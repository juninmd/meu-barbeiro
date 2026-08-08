import { expect, type Page, test, type TestInfo } from '@playwright/test'

const fixedNow = new Date('2026-07-17T12:00:00-03:00')
const saturday = '2026-07-18'
const closedSunday = '2026-07-19'

async function openCleanApp(page: Page) {
  await page.clock.setFixedTime(fixedNow)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Seu melhor corte começa antes da cadeira.' })).toBeVisible()
}

async function loginAs(page: Page, role: 'cliente' | 'barbeiro') {
  await page.getByRole('button', { name: new RegExp(`Visão ${role}`, 'i') }).click()
  await expect(page.getByRole('heading', {
    name: role === 'cliente' ? 'Reserve sua cadeira.' : 'A cadeira está pronta.',
  })).toBeVisible()
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    window.scrollTo(0, 0)
    await document.fonts.ready
  })
  const path = testInfo.outputPath('screenshots', `${name}.png`)
  await page.screenshot({
    path,
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}

test('registra acesso, troca de perfil e logout', async ({ page }, testInfo) => {
  await openCleanApp(page)
  await capture(page, testInfo, '01-login-com-acessos-mock')

  await loginAs(page, 'cliente')
  await expect(page.getByRole('heading', { name: 'Reserve sua cadeira.' })).toBeVisible()
  await capture(page, testInfo, '02-acesso-visao-cliente')

  await page.getByLabel('Trocar perfil mock').selectOption('BARBER')
  await expect(page.getByRole('heading', { name: 'A cadeira está pronta.' })).toBeVisible()
  await capture(page, testInfo, '03-troca-para-visao-barbeiro')

  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible()
  await capture(page, testInfo, '04-logout')
})

test('registra agendamento, validações, cancelamento e histórico do cliente', async ({ page }, testInfo) => {
  await openCleanApp(page)
  await loginAs(page, 'cliente')
  await capture(page, testInfo, '05-cliente-agenda-inicial')

  await page.getByRole('group', { name: /O que vamos fazer/ }).getByText('Corte assinatura', { exact: true }).click()
  await capture(page, testInfo, '06-cliente-servico-selecionado')

  await page.getByRole('group', { name: /Com quem/ }).getByText('Rafael Navalha', { exact: true }).click()
  await page.getByLabel('Data').fill(saturday)
  await page.getByRole('button', { name: 'Selecionar horário 11:00' }).click()
  await capture(page, testInfo, '07-cliente-agendamento-preenchido')

  await page.getByRole('button', { name: /Solicitar agendamento/i }).click()
  await expect(page.getByText('Pagamento aprovado. O barbeiro já recebeu seu horário.')).toBeVisible()
  const createdAppointment = page.locator('article').filter({ hasText: 'Corte assinatura' })
  await expect(createdAppointment).toContainText('Aguardando')
  await capture(page, testInfo, '08-cliente-agendamento-criado')

  await page.getByRole('group', { name: /O que vamos fazer/ }).getByText('Corte assinatura', { exact: true }).click()
  await page.getByRole('group', { name: /Com quem/ }).getByText('Rafael Navalha', { exact: true }).click()
  await page.getByLabel('Data').fill(closedSunday)
  await expect(page.getByText('A barbearia não atende neste dia')).toBeVisible()
  await capture(page, testInfo, '10-cliente-dia-fora-do-expediente')

  await createdAppointment.getByRole('button', { name: 'Cancelar horário' }).click()
  await page.getByRole('button', { name: 'Sim, cancelar' }).click()
  await expect(createdAppointment).toHaveCount(0)
  await capture(page, testInfo, '11-cliente-agendamento-cancelado')

  const confirmedAppointment = page.locator('article').filter({ hasText: 'Corte + barba' })
  await confirmedAppointment.getByRole('button', { name: 'Cancelar horário' }).click()
  await page.getByRole('button', { name: 'Sim, cancelar' }).click()
  await expect(page.getByText('Nenhum horário marcado')).toBeVisible()
  await capture(page, testInfo, '12-cliente-agenda-vazia')

  await page.getByText(/Ver histórico \(2\)/).click()
  await expect(page.getByText(/Corte assinatura/).last()).toBeVisible()
  await capture(page, testInfo, '13-cliente-historico-aberto')
})

test('registra confirmação, conclusão e cancelamento pelo barbeiro', async ({ page }, testInfo) => {
  await openCleanApp(page)
  await loginAs(page, 'barbeiro')
  await expect(page.getByRole('region', { name: 'Resumo da agenda' })).toContainText('Aguardando')
  await capture(page, testInfo, '14-barbeiro-dashboard-e-metricas')

  const pendingAppointment = page.locator('article').filter({ hasText: 'Pedro Lima' })
  await pendingAppointment.getByRole('button', { name: 'Confirmar' }).click()
  await expect(pendingAppointment).toContainText('Confirmado')
  await capture(page, testInfo, '15-barbeiro-agendamento-confirmado')

  await pendingAppointment.getByRole('button', { name: 'Concluir' }).click()
  await expect(pendingAppointment).toContainText('Concluído')
  await expect(pendingAppointment.getByRole('button', { name: 'Cancelar' })).toHaveCount(0)
  await capture(page, testInfo, '16-barbeiro-atendimento-concluido')

  const confirmedAppointment = page.locator('article').filter({ hasText: 'Lucas Rocha' })
  await confirmedAppointment.getByRole('button', { name: 'Cancelar' }).click()
  await expect(confirmedAppointment).toHaveCount(0)
  await capture(page, testInfo, '17-barbeiro-agendamento-cancelado')
})

test('registra cadastro, exclusão e proteção de serviços', async ({ page }, testInfo) => {
  await openCleanApp(page)
  await loginAs(page, 'barbeiro')
  const servicePanel = page.getByRole('region', { name: 'Serviços' })
  await capture(page, testInfo, '18-barbeiro-catalogo-de-servicos')

  await servicePanel.getByLabel('Nome').fill('Hidratação premium')
  await servicePanel.getByLabel('Duração (min)').fill('40')
  await servicePanel.getByLabel('Preço (R$)').fill('65')
  await capture(page, testInfo, '19-barbeiro-novo-servico-preenchido')

  await servicePanel.getByRole('button', { name: 'Adicionar ao menu' }).click()
  await expect(page.getByText('Serviço adicionado ao catálogo.')).toBeVisible()
  await expect(servicePanel.getByText('Hidratação premium')).toBeVisible()
  await capture(page, testInfo, '20-barbeiro-servico-adicionado')

  await servicePanel.getByRole('button', { name: 'Excluir Hidratação premium' }).click()
  await page.getByRole('button', { name: 'Sim, excluir' }).click()
  await expect(servicePanel.getByText('Hidratação premium')).toHaveCount(0)
  await capture(page, testInfo, '21-barbeiro-servico-excluido')

  await servicePanel.getByRole('button', { name: 'Excluir Corte assinatura' }).click()
  await page.getByRole('button', { name: 'Sim, excluir' }).click()
  await expect(page.getByText('Serviço possui agendamentos ativos')).toBeVisible()
  await expect(servicePanel.getByText('Corte assinatura')).toBeVisible()
  await capture(page, testInfo, '22-barbeiro-exclusao-de-servico-bloqueada')
})

test('registra responsividade das duas visões', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openCleanApp(page)
  await capture(page, testInfo, '23-mobile-login')

  await loginAs(page, 'cliente')
  const scheduleBox = await page.locator('.schedule-column').boundingBox()
  const bookingBox = await page.locator('.booking-panel').boundingBox()
  expect(scheduleBox).not.toBeNull()
  expect(bookingBox).not.toBeNull()
  expect(scheduleBox!.y).toBeLessThan(bookingBox!.y)
  await expect(page.locator('.location-card').filter({ hasText: 'Expediente:' })).toContainText('Expediente: Ter a Sáb · 09:00–20:00')

  await page.getByRole('radio', { name: /Corte assinatura/ }).check()
  await page.getByRole('radio', { name: /Rafael Navalha/ }).check()
  await page.getByLabel('Data').fill('2026-07-18')
  await expect(page.getByRole('heading', { name: 'Manhã' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tarde' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Noite' })).toBeVisible()
  const morningGrid = page.getByRole('region', { name: 'Manhã' }).locator('.slot-grid')
  await expect(morningGrid.getByRole('button').first()).toHaveAttribute('aria-label', /Selecionar horário/)
  expect(await morningGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(4)
  const availabilityTop = (await page.locator('.availability-heading').boundingBox())!.y
  const afternoonTop = (await page.getByRole('region', { name: 'Tarde' }).boundingBox())!.y
  expect(afternoonTop - availabilityTop).toBeLessThan(300)
  await capture(page, testInfo, '24-mobile-horarios-compactos')

  await page.getByRole('button', { name: 'Remarcar' }).click()
  const keptService = page.getByRole('radio', { name: /Corte \+ barba/ })
  const keptBarber = page.getByRole('radio', { name: /Rafael Navalha/ })
  await expect(keptService).toBeChecked()
  await expect(keptBarber).toBeChecked()
  await expect(keptService).toHaveCSS('opacity', '1')
  await expect(keptBarber).toHaveCSS('opacity', '1')
  await page.getByRole('button', { name: 'Manter horário atual' }).click()

  await page.getByRole('button', { name: 'Cancelar horário' }).click()
  await page.getByRole('button', { name: 'Sim, cancelar' }).click()
  await page.getByText(/Ver histórico/).click()
  await expect(page.locator('.history-item')).toContainText('Cancelado')
  await expect(page.locator('.history-item')).toContainText('Pagamento estornado')
  await capture(page, testInfo, '24-mobile-visao-cliente')

  await page.evaluate(() => {
    const key = 'meu-barbeiro:mock-state:v2'
    const state = JSON.parse(localStorage.getItem(key) || '{}')
    state.appointments
      .filter((appointment: { status: string }) => appointment.status !== 'CANCELLED')
      .forEach((appointment: { scheduledAt: string }, index: number) => {
        appointment.scheduledAt = `2026-07-18T${index === 0 ? '13:00' : '15:00'}:00.000Z`
      })
    localStorage.setItem(key, JSON.stringify(state))
  })
  await page.getByLabel('Trocar perfil mock').selectOption('BARBER')
  await expect(page.getByRole('heading', { name: 'A cadeira está pronta.' })).toBeVisible()
  await expect(page.getByText(/Sem atendimentos hoje · próximo: sáb., 18\/07 \(2 horários\)/)).toBeVisible()
  await capture(page, testInfo, '25-mobile-visao-barbeiro')
})

test('registra personalização, horários, sinal e conexão Mercado Pago', async ({ page }, testInfo) => {
  await openCleanApp(page)
  await loginAs(page, 'barbeiro')
  const settings = page.getByRole('region', { name: 'Sua barbearia' })
  await expect(settings).toContainText('R$ 20,00')
  await expect(settings).toContainText('1%')
  await expect(settings).toContainText('Conta conectada')
  await capture(page, testInfo, '26-saas-configuracao-inicial')

  await settings.getByRole('button', { name: 'Desconectar' }).click()
  await page.getByRole('button', { name: 'Sim, desconectar' }).click()
  await expect(settings.getByRole('button', { name: 'Conectar Mercado Pago' })).toBeVisible()
  await capture(page, testInfo, '27-mercado-pago-desconectado')

  await settings.getByRole('button', { name: 'Conectar Mercado Pago' }).click()
  await expect(settings.getByText('Mercado Pago conectado.')).toBeVisible()
  await capture(page, testInfo, '28-mercado-pago-conectado')

  await settings.getByLabel('Nome').fill('Navalha Club')
  await settings.getByLabel('Cor principal').fill('#2f6b58')
  await settings.getByLabel('Endereço').fill('Rua do Corte, 100 · Centro')
  await settings.getByLabel('Tipo de sinal').selectOption('PERCENTAGE')
  await settings.getByRole('spinbutton', { name: 'Percentual' }).fill('30')
  await settings.getByLabel('Abertura Sáb').fill('10:00')
  await settings.getByLabel('Fechamento Sáb').fill('18:00')
  await settings.getByRole('button', { name: 'Salvar configurações' }).click()
  await expect(page.locator('.brand')).toContainText('Navalha Club')
  await expect(page.getByText('Configurações publicadas.')).toBeVisible()
  await capture(page, testInfo, '29-barbeiro-marca-horarios-e-sinal-personalizados')

  await page.getByLabel('Trocar perfil mock').selectOption('CUSTOMER')
  await expect(page.locator('.location-card').filter({ hasText: 'Expediente:' })).toContainText('Navalha Club')
  await expect(page.getByText('Rua do Corte, 100 · Centro')).toBeVisible()
  await capture(page, testInfo, '30-cliente-experiencia-personalizada')
})

test('registra ativação da assinatura mensal', async ({ page }, testInfo) => {
  await openCleanApp(page)
  await loginAs(page, 'barbeiro')
  const settings = page.getByRole('region', { name: 'Sua barbearia' })
  await settings.getByRole('button', { name: 'Desconectar' }).click()
  await page.getByRole('button', { name: 'Sim, desconectar' }).click()
  await page.evaluate(() => {
    const key = 'meu-barbeiro:mock-state:v2'
    const state = JSON.parse(localStorage.getItem(key) || '{}')
    state.barbershop.subscriptionStatus = 'INACTIVE'
    localStorage.setItem(key, JSON.stringify(state))
  })
  await page.reload()
  await loginAs(page, 'barbeiro')
  const inactiveSettings = page.getByRole('region', { name: 'Sua barbearia' })
  await expect(inactiveSettings.getByRole('button', { name: 'Assinar por R$ 20/mês' })).toBeVisible()
  await capture(page, testInfo, '31-saas-assinatura-inativa')

  await inactiveSettings.getByRole('button', { name: 'Assinar por R$ 20/mês' }).click()
  await expect(inactiveSettings.getByText('Status: Ativa')).toBeVisible()
  await capture(page, testInfo, '32-saas-assinatura-ativada')
})
