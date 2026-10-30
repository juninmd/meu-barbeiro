import { expect, type Page } from '@playwright/test'

export const accounts = {
  admin: { identifier: 'admin', password: 'admin' },
  barbeiro: { identifier: 'rafael@demo.local', password: 'demo1234' },
  cliente: { identifier: 'marina@demo.local', password: 'demo1234' },
}

export async function signIn(page: Page, identifier: string, password: string) {
  await page.getByLabel('E-mail ou usuário').fill(identifier)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).last().click()
}

/** Entrada única: o papel vem do cadastro, então basta usar as credenciais da conta. */
export async function loginAs(page: Page, role: keyof typeof accounts) {
  await signIn(page, accounts[role].identifier, accounts[role].password)
  await expect(page).toHaveURL(role === 'cliente' ? /\/cliente\/horarios$/ : role === 'admin' ? /\/admin\/visao$/ : /\/barbeiro\/hoje$/)
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Menu da conta' }).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible()
}

export async function switchTo(page: Page, role: keyof typeof accounts) {
  await signOut(page)
  await loginAs(page, role)
}

/** Escolhe um dia no calendário do agendamento (formato AAAA-MM-DD, mês atual ou o seguinte). */
export async function pickDate(page: Page, isoDate: string) {
  const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${isoDate}T12:00:00Z`))
  const day = page.getByRole('button', { name: new RegExp(label, 'i') })
  if (!(await day.isVisible())) await page.getByRole('button', { name: /próximo mês|next month/i }).click()
  await day.click()
}
