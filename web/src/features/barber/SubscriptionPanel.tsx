import { BadgeCheck, CircleAlert, CreditCard, Loader2, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { Barbershop, SaasPlanId, SubscriptionResponse, SubscriptionState } from '../../types'

interface SubscriptionPanelProps {
  barbershop: Barbershop
  onRefresh: () => Promise<void>
}

const stateLabel: Record<SubscriptionState, string> = {
  TRIALING: 'Em teste grátis',
  ACTIVE: 'Ativa',
  PAST_DUE: 'Pagamento pendente',
  CANCELED: 'Cancelada',
  EXPIRED: 'Teste encerrado',
  INACTIVE: 'Sem assinatura',
}

const stateTone: Record<SubscriptionState, 'success' | 'warning' | 'danger' | 'neutral'> = {
  TRIALING: 'warning',
  ACTIVE: 'success',
  PAST_DUE: 'danger',
  CANCELED: 'danger',
  EXPIRED: 'danger',
  INACTIVE: 'danger',
}

export function SubscriptionPanel({ barbershop, onRefresh }: SubscriptionPanelProps) {
  const [data, setData] = useState<SubscriptionResponse | null>(null)
  const [selected, setSelected] = useState<SaasPlanId>(barbershop.plan ?? 'STARTER')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  useEffect(() => {
    repository.subscription()
      .then((response) => {
        setData(response)
        setSelected(response.subscription.plan)
      })
      .catch((caught) => setError(errorMessage(caught, 'Não foi possível carregar a assinatura')))
  }, [])

  const reload = async () => {
    setData(await repository.subscription())
    await onRefresh()
  }

  const choose = async (plan: SaasPlanId) => {
    if (!data || data.subscription.state === 'ACTIVE') {
      setSelected(plan)
      return
    }
    setBusy('plan')
    setError(null)
    try {
      await repository.choosePlan(plan)
      setSelected(plan)
      await reload()
      toast.success('Plano selecionado. Ele vale a partir da assinatura.')
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível trocar o plano'))
    } finally {
      setBusy(null)
    }
  }

  const subscribe = async () => {
    setBusy('subscribe')
    setError(null)
    try {
      const { checkoutUrl } = await repository.subscribe(selected)
      if (checkoutUrl) {
        window.location.assign(checkoutUrl)
        return
      }
      toast.success('Assinatura solicitada.')
      await reload()
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível abrir o checkout'))
    } finally {
      setBusy(null)
    }
  }

  const cancel = async () => {
    setBusy('cancel')
    try {
      await repository.cancelSubscription()
      setCancelOpen(false)
      await reload()
      toast.success('Assinatura cancelada. A barbearia fica em modo leitura até reativar.')
    } catch (caught) {
      toast.error(errorMessage(caught, 'Não foi possível cancelar'))
    } finally {
      setBusy(null)
    }
  }

  if (!data) {
    return <Card><p className="text-muted">{error ?? 'Carregando assinatura…'}</p></Card>
  }

  const { subscription, plans } = data

  return (
    <div className="grid gap-5">
      <Card>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-[.72rem] font-extrabold tracking-[.14em] text-brand-deep uppercase">Sua conta no Meu Barbeiro</p>
            <h2 className="font-serif text-2xl">Assinatura</h2>
          </div>
          <Badge tone={stateTone[subscription.state]}>{stateLabel[subscription.state]}</Badge>
        </div>

        {error && <p className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-ink" role="alert">{error}</p>}

        <dl className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface-2 p-3">
            <dt className="text-[.62rem] font-black tracking-[.08em] text-muted uppercase">Plano atual</dt>
            <dd className="font-serif text-lg">{subscription.planName}</dd>
            <dd className="text-xs text-muted">{formatCurrency(subscription.monthlyFeeCents / 100)}/mês</dd>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-3">
            <dt className="text-[.62rem] font-black tracking-[.08em] text-muted uppercase">Teste grátis</dt>
            <dd className="font-serif text-lg">{subscription.trialDaysLeft > 0 ? `${subscription.trialDaysLeft} dia${subscription.trialDaysLeft === 1 ? '' : 's'}` : '—'}</dd>
            <dd className="text-xs text-muted">{subscription.trialEndsAt ? `até ${new Date(subscription.trialEndsAt).toLocaleDateString('pt-BR')}` : 'sem teste ativo'}</dd>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-3">
            <dt className="text-[.62rem] font-black tracking-[.08em] text-muted uppercase">Recebimentos</dt>
            <dd className="font-serif text-lg">{data.mercadoPagoConnected ? 'Conectado' : 'Não conectado'}</dd>
            <dd className="text-xs text-muted">{data.mercadoPagoConnected ? 'Sinal cai na sua conta' : 'Conecte em Ajustes'}</dd>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-3">
            <dt className="text-[.62rem] font-black tracking-[.08em] text-muted uppercase">E-mail de cobrança</dt>
            <dd className="truncate text-sm font-bold">{data.billingEmail ?? 'sem e-mail'}</dd>
            <dd className="text-xs text-muted">Mercado Pago</dd>
          </div>
        </dl>

        {subscription.isBlocked && (
          <div className="mb-5 flex gap-3 rounded-xl border border-danger/40 bg-danger-soft p-4" role="alert">
            <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-danger-ink" />
            <div>
              <strong className="block text-sm text-danger-ink">A barbearia está em modo leitura</strong>
              <p className="text-xs text-danger-ink/80">Sua página continua no ar e os dados estão salvos. Escolha um plano para voltar a editar serviços, equipe e preços.</p>
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const current = plan.id === subscription.plan
            return (
              <article key={plan.id} className={`relative flex flex-col gap-2 rounded-2xl border p-4 ${selected === plan.id ? 'border-brand shadow-card' : 'border-line'} ${plan.recommended ? 'bg-surface' : 'bg-surface-2'}`}>
                {plan.recommended && <span className="absolute -top-3 left-4 rounded-full bg-brand px-2 py-0.5 text-[.6rem] font-black tracking-[.08em] text-on-brand uppercase">Mais escolhido</span>}
                <h3 className="font-serif text-xl">{plan.name}</h3>
                <p className="min-h-[2.4em] text-xs text-muted">{plan.tagline}</p>
                <strong className="font-serif text-2xl">{formatCurrency(plan.monthlyFeeCents / 100)}<small className="font-sans text-xs font-normal text-muted">/mês</small></strong>
                <small className="-mt-1 text-xs text-muted">ou {formatCurrency(plan.annualFeeCents / 100)}/ano</small>
                <ul className="my-2 grid gap-1.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5 text-xs leading-snug"><BadgeCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-success-ink" /> {feature}</li>
                  ))}
                </ul>
                <Button
                  className="mt-auto"
                  variant={selected === plan.id ? 'dark' : 'ghost'}
                  disabled={busy !== null}
                  onClick={() => void choose(plan.id)}
                >
                  {current && subscription.state === 'ACTIVE' ? 'Plano atual' : selected === plan.id ? 'Selecionado' : 'Escolher'}
                </Button>
              </article>
            )
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4">
          {subscription.state !== 'ACTIVE' && (
            <Button onClick={subscribe} disabled={busy !== null}>
              {busy === 'subscribe' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CreditCard aria-hidden="true" />}
              Assinar {selected === subscription.plan ? 'agora' : 'o plano selecionado'}
            </Button>
          )}
          {subscription.state === 'ACTIVE' && (
            <Button variant="ghost" disabled={busy !== null} onClick={() => setCancelOpen(true)}>Cancelar assinatura</Button>
          )}
          <p className="flex-1 text-xs text-muted">
            Cobrança mensal pelo Mercado Pago. No anual, dois meses são grátis. Comissão de 1% por serviço pago online, separada da mensalidade.
          </p>
        </div>

        {subscription.isBlocked && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><CircleAlert aria-hidden="true" className="size-3.5" /> Leitura e página pública continuam funcionando; só a edição fica bloqueada.</p>
        )}
      </Card>

      {cancelOpen && (
        <ConfirmDialog
          eyebrow="Cancelar assinatura"
          title="Cancelar a assinatura do Meu Barbeiro?"
          description="A cobrança para no próximo ciclo. A barbearia fica em modo leitura até reativar."
          cancelLabel="Manter assinatura"
          confirmLabel={busy === 'cancel' ? 'Cancelando…' : 'Sim, cancelar'}
          busy={busy === 'cancel'}
          onCancel={() => setCancelOpen(false)}
          onConfirm={cancel}
        />
      )}
    </div>
  )
}
