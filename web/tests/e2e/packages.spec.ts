import { expect, test } from '@playwright/test'
import { loginAs, signOut } from './helpers'

test('dono cria pacote, vende ao cliente, dá baixa e o cliente acompanha o saldo', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()

  await loginAs(page, 'barbeiro')
  await page.getByRole('link', { name: 'Ajustes' }).click()
  const panel = page.getByRole('region', { name: 'Pacotes de sessões' })
  await expect(panel.getByText('Pacote 5 cortes')).toBeVisible()
  const form = panel.getByRole('form', { name: 'Novo pacote' })
  await form.getByLabel('Nome do pacote').fill('Combo 10 barbas')
  await form.getByLabel('Serviço coberto').selectOption({ label: 'Barba terapêutica' })
  await form.getByLabel('Sessões').fill('10')
  await form.getByLabel('Preço do pacote (R$)').fill('300')
  await expect(form.getByText('R$ 30,00 por sessão')).toBeVisible()
  await form.getByRole('button', { name: 'Criar pacote' }).click()
  await expect(panel.getByText('Combo 10 barbas')).toBeVisible()
  await panel.getByRole('button', { name: 'Desativar Combo 10 barbas' }).click()
  await expect(panel.getByText('Desativado')).toBeVisible()

  // venda e baixa na ficha da Marina
  await page.getByRole('link', { name: 'Clientes', exact: true }).click()
  const marina = page.locator('article').filter({ hasText: 'Marina Costa' })
  await marina.getByRole('button', { name: /ficha/i }).click()
  const packages = page.getByRole('region', { name: 'Pacotes do cliente' })
  await expect(packages.getByText('Este cliente não tem pacotes.')).toBeVisible()
  await packages.getByLabel('Vender pacote').selectOption({ label: 'Pacote 5 cortes · R$ 220,00' })
  await packages.getByRole('button', { name: 'Vender', exact: true }).click()
  await expect(packages.getByText('5 de 5 sessões restantes').first()).toBeVisible()
  await packages.getByRole('button', { name: 'Registrar uso' }).click()
  await expect(packages.getByText('4 de 5 sessões restantes').first()).toBeVisible()
  await signOut(page)

  // cliente vê o saldo e a página pública lista o pacote ativo
  await loginAs(page, 'cliente')
  await page.getByRole('link', { name: 'Perfil' }).click()
  const mine = page.getByRole('region', { name: 'Meus pacotes' })
  await expect(mine.getByText('4 de 5 sessões restantes').first()).toBeVisible()
  await expect(mine.getByText('Ativo')).toBeVisible()
  await signOut(page)
  await page.goto('/b/barbearia-central')
  const publicPackages = page.getByRole('region', { name: 'Pacotes' })
  await expect(publicPackages.getByText('Pacote 5 cortes')).toBeVisible()
  await expect(publicPackages.getByText('R$ 44,00 por sessão')).toBeVisible()
  await expect(publicPackages.getByText('Combo 10 barbas')).toHaveCount(0)
})
