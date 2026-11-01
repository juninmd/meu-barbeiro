import { Building2, CircleDollarSign, RefreshCw, Timer, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Select } from '../../components/ui/Field'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { PlatformOverview, PlatformShop, SaasPlanId } from '../../types'

const planLabel: Record<SaasPlanId, string> = { STARTER: 'Essencial', PRO: 'Profissional', SCALE: 'Escala' }

export function RevenuePanel() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null)
  const [shops, setShops] = useState<PlatformShop[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [summary, list] = await Promise.all([repository.platformOverview(), repository.platformShops()])
      setOverview(summary)
      setShops(list.items)
    } catch (caught) {
      toast.error(errorMessage(caught, 'Não foi possível carregar a receita.'))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const update = async (shop: PlatformShop, input: { plan?: SaasPlanId; extendTrialDays?: number }) => {
    setBusyId(shop.id)
    try {
      await repository.platformUpdateShop(shop.id, input)
      toast.success(input.plan ? `Plano de ${shop.name} alterado.` : `Teste de ${shop.name} estendido.`)
      await load()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Não foi possível atualizar.'))
    } finally {
      setBusyId(null)
    }
  }

  if (!overview) return null

  return (
    <div className="mt-6 grid gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <article className="grid gap-0.5 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
          <span className="mb-2 grid size-10 place-items-center rounded-xl bg-linear-to-br from-brand/30 to-brand/10 text-brand-deep" aria-hidden="true"><CircleDollarSign className="size-5" /></span>
          <strong className="font-serif text-3xl leading-none font-medium">{formatCurrency(overview.revenue.mrrCents / 100)}</strong>
          <span className="text-[.78rem] font-bold text-muted">MRR · {overview.revenue.payingShops} pagando</span>
        </article>
        <article className="grid gap-0.5 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
          <span className="mb-2 grid size-10 place-items-center rounded-xl bg-linear-to-br from-brand/30 to-brand/10 text-brand-deep" aria-hidden="true"><TrendingUp className="size-5" /></span>
          <strong className="font-serif text-3xl leading-none font-medium">{formatCurrency(overview.revenue.arrCents / 100)}</strong>
          <span className="text-[.78rem] font-bold text-muted">ARR projetado</span>
        </article>
        <article className="grid gap-0.5 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
          <span className="mb-2 grid size-10 place-items-center rounded-xl bg-linear-to-br from-brand/30 to-brand/10 text-brand-deep" aria-hidden="true"><Timer className="size-5" /></span>
          <strong className="font-serif text-3xl leading-none font-medium">{overview.shops.trialing}</strong>
          <span className="text-[.78rem] font-bold text-muted">Em teste · {overview.shops.trialsExpiringIn30Days} vencem em 30 dias</span>
        </article>
        <article className="grid gap-0.5 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
          <span className="mb-2 grid size-10 place-items-center rounded-xl bg-linear-to-br from-brand/30 to-brand/10 text-brand-deep" aria-hidden="true"><Building2 className="size-5" /></span>
          <strong className="font-serif text-3xl leading-none font-medium">{overview.shops.total}</strong>
          <span className="text-[.78rem] font-bold text-muted">Barbearias · {overview.shops.newLast30Days} novas em 30 dias</span>
        </article>
      </div>

      <Card as="section" aria-labelledby="revenue-title">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="revenue-title" className="font-serif text-2xl font-medium tracking-tight">Receita por estabelecimento</h2>
            <p className="text-sm text-muted">Ajuste o plano ou estenda o teste sem precisar de SQL.</p>
          </div>
          <Badge tone="neutral">{shops.length}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="text-left text-[.62rem] tracking-[.09em] text-muted uppercase">
                <th className="py-2 pr-3">Barbearia</th><th className="py-2 pr-3">Plano</th><th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Equipe</th><th className="py-2 pr-3">Mensalidade</th><th className="py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => (
                <tr key={shop.id} className="border-t border-line/70">
                  <td className="py-2.5 pr-3"><strong className="block">{shop.name}</strong><small className="text-xs text-muted">/b/{shop.slug}</small></td>
                  <td className="py-2.5 pr-3">
                    <Select aria-label={`Plano de ${shop.name}`} value={shop.plan} disabled={busyId === shop.id} onChange={(event) => void update(shop, { plan: event.target.value as SaasPlanId })} className="w-auto">
                      {Object.entries(planLabel).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </Select>
                  </td>
                  <td className="py-2.5 pr-3"><Badge tone={shop.subscription.isBlocked ? 'danger' : shop.subscription.state === 'TRIALING' ? 'warning' : 'success'}>{shop.subscription.state}</Badge></td>
                  <td className="py-2.5 pr-3">{shop.professionals}</td>
                  <td className="py-2.5 pr-3">{formatCurrency(shop.monthlyFeeCents / 100)}</td>
                  <td className="py-2.5">
                    <Button size="sm" variant="ghost" disabled={busyId === shop.id} onClick={() => void update(shop, { extendTrialDays: 14 })}>
                      <RefreshCw aria-hidden="true" /> +14 dias
                    </Button>
                  </td>
                </tr>
              ))}
              {shops.length === 0 && <tr><td colSpan={6} className="py-4 text-muted">Nenhuma barbearia ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
