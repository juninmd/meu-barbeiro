import { CreditCard, Link2, Save, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { Barbershop } from '../../types'

interface BarbershopSettingsProps {
  barbershop: Barbershop
  onRefresh: () => Promise<void>
}

const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function BarbershopSettings({ barbershop, onRefresh }: BarbershopSettingsProps) {
  const [form, setForm] = useState(barbershop)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => setForm(barbershop), [barbershop])

  const act = async (action: () => Promise<void>, success: string) => {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      await onRefresh()
      setMessage(success)
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível salvar a configuração'))
    } finally {
      setBusy(false)
    }
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    void act(async () => { await repository.updateBarbershop(form) }, 'Configurações publicadas.')
  }

  const subscribe = () => void act(async () => {
    const { checkoutUrl } = await repository.subscribe()
    if (checkoutUrl) window.location.assign(checkoutUrl)
  }, 'Assinatura ativada no ambiente de demonstração.')

  const connect = () => void act(async () => {
    const { authorizationUrl } = await repository.connectMercadoPago()
    if (authorizationUrl) window.location.assign(authorizationUrl)
  }, 'Mercado Pago conectado.')

  const disconnect = () => void act(repository.disconnectMercadoPago, 'Mercado Pago desconectado.')

  return (
    <section className="settings-stack" aria-labelledby="settings-title">
      <div className="section-heading">
        <div><p className="eyebrow">Operação SaaS</p><h2 id="settings-title">Sua barbearia</h2></div>
      </div>

      <div className="billing-grid">
        <article className="billing-card">
          <CreditCard aria-hidden="true" />
          <span>Assinatura do sistema</span>
          <strong>{formatCurrency(barbershop.monthlyFeeCents / 100)}<small>/mês</small></strong>
          <p>Status: <b>{subscriptionLabel(barbershop.subscriptionStatus)}</b></p>
          {barbershop.subscriptionStatus !== 'ACTIVE' && (
            <button className="button button-primary" disabled={busy} onClick={subscribe}>Assinar por R$ 20/mês</button>
          )}
        </article>
        <article className="billing-card">
          <Link2 aria-hidden="true" />
          <span>Recebimentos</span>
          <strong>Mercado Pago</strong>
          <p>{barbershop.mercadoPagoConnected ? 'Conta conectada' : 'Conecte a conta que receberá os serviços'}</p>
          <button className={`button ${barbershop.mercadoPagoConnected ? 'button-ghost' : 'button-primary'}`} disabled={busy} onClick={barbershop.mercadoPagoConnected ? disconnect : connect}>
            {barbershop.mercadoPagoConnected ? 'Desconectar' : 'Conectar Mercado Pago'}
          </button>
        </article>
        <article className="billing-card">
          <Store aria-hidden="true" />
          <span>Comissão da plataforma</span>
          <strong>{barbershop.commissionBps / 100}%</strong>
          <p>Calculada sobre o valor de cada serviço pago.</p>
        </article>
      </div>

      <form className="panel settings-form" onSubmit={save}>
        <div className="settings-columns">
          <fieldset>
            <legend>Marca e endereço</legend>
            <label>Nome<input value={form.name} minLength={3} required onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label>URL do logotipo<input type="url" placeholder="https://.../logo.png" value={form.logoUrl || ''} onChange={(event) => setForm({ ...form, logoUrl: event.target.value })} /></label>
            <label>Cor principal<input type="color" value={form.primaryColor} onChange={(event) => setForm({ ...form, primaryColor: event.target.value })} /></label>
            <label>Endereço<input value={form.address || ''} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
          </fieldset>

          <fieldset>
            <legend>Pagamento antecipado</legend>
            <label>Tipo de sinal
              <select value={form.depositType} onChange={(event) => setForm({ ...form, depositType: event.target.value as Barbershop['depositType'], depositValue: 0 })}>
                <option value="NONE">Sem sinal</option>
                <option value="FULL">Pagamento integral</option>
                <option value="PERCENTAGE">Percentual</option>
                <option value="FIXED">Valor fixo</option>
              </select>
            </label>
            {form.depositType === 'PERCENTAGE' && (
              <label>Percentual<input type="number" min="1" max="100" value={form.depositValue || ''} onChange={(event) => setForm({ ...form, depositValue: Number(event.target.value) })} required /></label>
            )}
            {form.depositType === 'FIXED' && (
              <label>Valor do sinal (R$)<input type="number" min="0.01" step="0.01" value={form.depositValue ? form.depositValue / 100 : ''} onChange={(event) => setForm({ ...form, depositValue: Math.round(Number(event.target.value) * 100) })} required /></label>
            )}
            <p className="settings-hint">A comissão permanece em 1% do serviço. O Mercado Pago desconta a tarifa própria antes do repasse.</p>
          </fieldset>
        </div>

        <fieldset>
          <legend>Horários de funcionamento</legend>
          <div className="hours-grid">
            {form.businessHours.map((hour, index) => (
              <div className="hour-row" key={hour.weekday}>
                <label className="hour-toggle"><input type="checkbox" checked={hour.enabled} onChange={(event) => {
                  const next = [...form.businessHours]
                  next[index] = { ...hour, enabled: event.target.checked }
                  setForm({ ...form, businessHours: next })
                }} /> {weekdays[hour.weekday]}</label>
                <input aria-label={`Abertura ${weekdays[hour.weekday]}`} type="time" value={hour.opensAt} disabled={!hour.enabled} onChange={(event) => {
                  const next = [...form.businessHours]
                  next[index] = { ...hour, opensAt: event.target.value }
                  setForm({ ...form, businessHours: next })
                }} />
                <span>até</span>
                <input aria-label={`Fechamento ${weekdays[hour.weekday]}`} type="time" value={hour.closesAt} disabled={!hour.enabled} onChange={(event) => {
                  const next = [...form.businessHours]
                  next[index] = { ...hour, closesAt: event.target.value }
                  setForm({ ...form, businessHours: next })
                }} />
              </div>
            ))}
          </div>
        </fieldset>

        {message && <p className="form-message" role="status">{message}</p>}
        <button className="button button-dark" disabled={busy}><Save aria-hidden="true" /> Salvar configurações</button>
      </form>
    </section>
  )
}

const subscriptionLabel = (status: Barbershop['subscriptionStatus']) => ({
  ACTIVE: 'Ativa', PENDING: 'Aguardando pagamento', PAST_DUE: 'Pagamento atrasado', CANCELED: 'Cancelada', INACTIVE: 'Inativa',
})[status || 'INACTIVE']
