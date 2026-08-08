import { CalendarDays, CreditCard, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatCurrency } from '../lib/format'
import { errorMessage, repository } from '../lib/repository'
import type { Barber, CustomerSubscription, MembershipPlan, NewMembershipPlan, RecurringBooking, Service } from '../types'

interface MembershipPanelProps {
  mode: 'customer' | 'management'
  services: Service[]
  barbers: Barber[]
}

const weekdays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export function MembershipPanel({ mode, services, barbers }: MembershipPanelProps) {
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [subscription, setSubscription] = useState<CustomerSubscription | null>(null)
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([])
  const [bookings, setBookings] = useState<RecurringBooking[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [planForm, setPlanForm] = useState<NewMembershipPlan>({ name: '', priceCents: 0, intervalDays: 30, includedVisits: 1, serviceIds: [] })
  const [bookingForm, setBookingForm] = useState({ barberId: '', serviceId: '', weekday: 1, time: '09:00' })

  const load = async () => {
    const [nextPlans, nextBookings] = await Promise.all([repository.membershipPlans(), repository.recurringBookings()])
    setPlans(nextPlans)
    setBookings(nextBookings)
    if (mode === 'customer') setSubscription(await repository.customerSubscription())
    else setSubscriptions(await repository.customerSubscriptions())
  }

  useEffect(() => { void load().catch((error) => setMessage(errorMessage(error, 'Não foi possível carregar as assinaturas'))) }, [mode])

  const act = async (action: () => Promise<void>, success: string) => {
    setBusy(true)
    setMessage(null)
    try { await action(); await load(); setMessage(success) }
    catch (error) { setMessage(errorMessage(error, 'Não foi possível concluir')) }
    finally { setBusy(false) }
  }

  const createPlan = (event: React.FormEvent) => {
    event.preventDefault()
    void act(async () => {
      await repository.createMembershipPlan(planForm)
      setPlanForm({ name: '', priceCents: 0, intervalDays: 30, includedVisits: 1, serviceIds: [] })
    }, 'Plano criado.')
  }

  const createBooking = (event: React.FormEvent) => {
    event.preventDefault()
    if (!subscription) return
    void act(async () => {
      await repository.createRecurringBooking({
        subscriptionId: subscription.id, barberId: bookingForm.barberId,
        serviceIds: [bookingForm.serviceId], weekday: bookingForm.weekday, time: bookingForm.time,
      })
    }, 'Horário fixo criado. As próximas ocorrências serão geradas automaticamente.')
  }

  const pending = bookings.flatMap((booking) => booking.occurrences
    .filter((occurrence) => occurrence.status === 'PENDING')
    .map((occurrence) => ({ booking, occurrence })))

  return (
    <section className="panel membership-panel" aria-labelledby={`membership-${mode}`}>
      <div className="section-heading compact">
        <div><p className="eyebrow">Clube da barbearia</p><h2 id={`membership-${mode}`}>{mode === 'customer' ? 'Sua assinatura de cliente' : 'Planos e assinantes'}</h2></div>
        <CreditCard aria-hidden="true" />
      </div>
      <p className="form-message">Esta assinatura liga o cliente à barbearia. Ela é diferente da assinatura da barbearia com a plataforma Meu Barbeiro.</p>
      {message && <p className="form-message" role="status">{message}</p>}

      {mode === 'customer' ? (
        <>
          {subscription ? (
            <div className="service-row">
              <div>
                <strong>{subscription.plan.name} · {subscription.status}</strong>
                <span>{subscription.visitsUsed} usadas · {Math.max(0, subscription.plan.includedVisits - subscription.visitsUsed)} restantes até {new Intl.DateTimeFormat('pt-BR').format(new Date(subscription.currentPeriodEnd))}</span>
              </div>
              {subscription.status !== 'CANCELLED' && <button className="button button-small button-ghost" disabled={busy} onClick={() => void act(() => repository.cancelCustomerSubscription(subscription.id), 'Assinatura cancelada. Os horários já criados continuam válidos.')}>Cancelar</button>}
            </div>
          ) : (
            <div className="service-list">
              {plans.filter((plan) => plan.active).map((plan) => (
                <article className="service-row" key={plan.id}>
                  <div><strong>{plan.name} · {formatCurrency(plan.priceCents / 100)}</strong><span>{plan.includedVisits} visita(s) a cada {plan.intervalDays} dias</span></div>
                  <button className="button button-small button-primary" disabled={busy} onClick={() => void act(async () => {
                    const result = await repository.subscribeMembership(plan.id)
                    if (result.checkoutUrl) window.location.assign(result.checkoutUrl)
                  }, 'Assinatura iniciada.')}>Assinar</button>
                </article>
              ))}
            </div>
          )}
          {subscription?.status === 'ACTIVE' && (
            <form className="service-form" onSubmit={createBooking}>
              <h3><CalendarDays aria-hidden="true" /> Horário fixo</h3>
              <label>Serviço<select required value={bookingForm.serviceId} onChange={(event) => setBookingForm({ ...bookingForm, serviceId: event.target.value })}><option value="">Selecione</option>{services.filter((service) => subscription.plan.serviceIds.includes(service.id)).map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</select></label>
              <label>Profissional<select required value={bookingForm.barberId} onChange={(event) => setBookingForm({ ...bookingForm, barberId: event.target.value })}><option value="">Selecione</option>{barbers.map((barber) => <option value={barber.id} key={barber.id}>{barber.name}</option>)}</select></label>
              <div className="form-row">
                <label>Dia<select value={bookingForm.weekday} onChange={(event) => setBookingForm({ ...bookingForm, weekday: Number(event.target.value) })}>{weekdays.map((label, index) => <option value={index} key={label}>{label}</option>)}</select></label>
                <label>Hora<input type="time" required value={bookingForm.time} onChange={(event) => setBookingForm({ ...bookingForm, time: event.target.value })} /></label>
              </div>
              <button className="button button-dark" disabled={busy}><Plus aria-hidden="true" /> Criar horário fixo</button>
            </form>
          )}
          {bookings.filter((booking) => booking.active).map((booking) => <div className="service-row" key={booking.id}><div><strong>{weekdays[booking.weekday]} às {booking.time}</strong><span>{booking.barber?.name ?? 'Profissional definido'} · ocorrências futuras respeitam agenda e conflitos</span></div><button className="icon-button subtle" aria-label="Excluir horário fixo" disabled={busy} onClick={() => void act(() => repository.deleteRecurringBooking(booking.id), 'Horário fixo desativado. Agendamentos já criados foram mantidos.')}><Trash2 aria-hidden="true" /></button></div>)}
        </>
      ) : (
        <>
          <form className="service-form" onSubmit={createPlan}>
            <h3><Plus aria-hidden="true" /> Novo plano</h3>
            <label>Nome<input required minLength={3} value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} /></label>
            <div className="form-row"><label>Preço (R$)<input type="number" min="1" step="0.01" required value={planForm.priceCents ? planForm.priceCents / 100 : ''} onChange={(event) => setPlanForm({ ...planForm, priceCents: Math.round(Number(event.target.value) * 100) })} /></label><label>Período (dias)<input type="number" min="1" required value={planForm.intervalDays} onChange={(event) => setPlanForm({ ...planForm, intervalDays: Number(event.target.value) })} /></label><label>Visitas<input type="number" min="1" required value={planForm.includedVisits} onChange={(event) => setPlanForm({ ...planForm, includedVisits: Number(event.target.value) })} /></label></div>
            <fieldset><legend>Serviços cobertos</legend>{services.map((service) => <label className="check-row" key={service.id}><input type="checkbox" checked={planForm.serviceIds.includes(service.id)} onChange={(event) => setPlanForm({ ...planForm, serviceIds: event.target.checked ? [...planForm.serviceIds, service.id] : planForm.serviceIds.filter((id) => id !== service.id) })} /> {service.name}</label>)}</fieldset>
            <button className="button button-dark" disabled={busy || planForm.serviceIds.length === 0}>Criar plano</button>
          </form>
          <div className="service-list">{plans.map((plan) => <div className="service-row" key={plan.id}><div><strong>{plan.name} · {formatCurrency(plan.priceCents / 100)}</strong><span>{plan.includedVisits} visita(s) / {plan.intervalDays} dias · {plan.active ? 'ativo' : 'inativo'}</span></div></div>)}</div>
          <h3>Assinantes</h3>
          {subscriptions.length === 0 ? <p className="empty-copy">Nenhum assinante ainda.</p> : subscriptions.map((item) => <div className="service-row" key={item.id}><div><strong>{item.user?.name ?? 'Cliente'} · {item.plan.name}</strong><span>{item.visitsUsed}/{item.plan.includedVisits} visitas usadas · {item.status}</span></div></div>)}
          <h3>Ocorrências pendentes de resolução</h3>
          {pending.length === 0 ? <p className="empty-copy">Nenhuma falha na geração dos horários fixos.</p> : pending.map(({ booking, occurrence }) => <div className="service-row" key={occurrence.id}><div><strong>{booking.user?.name ?? 'Cliente'} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(occurrence.scheduledAt))}</strong><span>{occurrence.reason}</span></div></div>)}
        </>
      )}
    </section>
  )
}
