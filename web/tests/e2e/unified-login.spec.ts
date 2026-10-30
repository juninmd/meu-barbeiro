import { expect, type Page, test } from '@playwright/test'
import { loginAs, signIn, signOut } from './helpers'

async function openCleanApp(page: Page) {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible()
}

test('login único recusa credenciais erradas e não oferece escolha de perfil', async ({ page }) => {
  await openCleanApp(page)
  await expect(page.getByRole('button', { name: /Visão (cliente|barbeiro)/i })).toHaveCount(0)
  await signIn(page, 'admin', 'senha-errada')
  await expect(page.getByRole('alert')).toContainText('Usuário ou senha incorretos')
  await expect(page).not.toHaveURL(/admin/)
})

test('formulários mostram erros por campo antes de chamar o servidor', async ({ page }) => {
  await openCleanApp(page)
  await page.getByRole('button', { name: 'Entrar', exact: true }).last().click()
  await expect(page.getByText('Informe seu e-mail ou usuário.')).toBeVisible()
  await expect(page.getByText('Informe sua senha.')).toBeVisible()

  await page.getByRole('tab', { name: 'Criar conta' }).click()
  await page.getByLabel('Nome completo').fill('Ana')
  await page.getByLabel('E-mail', { exact: true }).fill('isto-nao-e-email')
  await page.getByLabel('Senha', { exact: true }).fill('senha-forte-1')
  await page.getByRole('button', { name: 'Criar conta' }).last().click()
  await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
})

test('cadastro exige senha de 8 caracteres', async ({ page }) => {
  await openCleanApp(page)
  await page.getByRole('tab', { name: 'Criar conta' }).click()
  await page.getByLabel('Nome completo').fill('Ana')
  await page.getByLabel('E-mail', { exact: true }).fill('ana@teste.com')
  await page.getByLabel('Senha', { exact: true }).fill('curta')
  await page.getByRole('button', { name: 'Criar conta' }).last().click()
  await expect(page.getByRole('alert')).toContainText('pelo menos 8 caracteres')
})

test('o administrador libera um usuário a cadastrar o estabelecimento onde é barbeiro', async ({ page }) => {
  await openCleanApp(page)

  await page.getByRole('tab', { name: 'Criar conta' }).click()
  await page.getByLabel('Nome completo').fill('João Silva')
  await page.getByLabel('E-mail', { exact: true }).fill('joao@barbearia.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-forte-1')
  await page.getByRole('button', { name: 'Criar conta' }).last().click()
  await expect(page).toHaveURL(/\/cliente\//)

  // sem liberação não há formulário de estabelecimento
  await page.getByRole('link', { name: 'Meu negócio' }).first().click()
  await expect(page.getByLabel('Nome da barbearia')).toHaveCount(0)
  await page.getByLabel('Qual é o seu estabelecimento?').fill('Barbearia do João, Pinheiros')
  await page.getByRole('button', { name: 'Enviar solicitação' }).click()
  await expect(page.getByText('Solicitação em análise')).toBeVisible()
  await signOut(page)

  // cliente comum não enxerga o painel do administrador
  await signIn(page, 'joao@barbearia.com', 'senha-forte-1')
  await page.goto('/admin/visao')
  await expect(page).toHaveURL(/\/cliente\//)
  await signOut(page)

  await loginAs(page, 'admin')
  await expect(page.getByRole('heading', { name: 'Visão da plataforma.' })).toBeVisible()
  await page.getByRole('link', { name: 'Liberações' }).first().click()
  await expect(page.getByText('Barbearia do João, Pinheiros')).toBeVisible()
  await page.getByRole('button', { name: 'Aprovar' }).click()
  await expect(page.getByText('João Silva já pode cadastrar o estabelecimento.')).toBeVisible()
  await signOut(page)

  await signIn(page, 'joao@barbearia.com', 'senha-forte-1')
  await page.getByRole('link', { name: 'Meu negócio' }).first().click()
  await page.getByLabel('Nome da barbearia').fill('Barbearia do João')
  await expect(page.getByLabel('Endereço do seu link')).toHaveValue('barbearia-do-joao')
  await page.getByRole('button', { name: 'Cadastrar estabelecimento' }).click()
  await expect(page).toHaveURL(/\/barbeiro\/hoje$/)
  await expect(page.locator('.brand')).toContainText('Barbearia do João')
})

test('tema escuro: escolha no menu da conta vale na página e persiste após recarregar', async ({ page }) => {
  await openCleanApp(page)
  await loginAs(page, 'cliente')
  await page.getByRole('button', { name: 'Menu da conta' }).click()
  await page.getByRole('menuitemradio', { name: 'Escuro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Menu da conta' }).click()
  await page.getByRole('menuitemradio', { name: 'Automático' }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
})
