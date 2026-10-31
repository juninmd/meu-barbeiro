import { CalendarDays, CreditCard, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatCurrency } from '../lib/format'
import { errorMessage, repository } from '../lib/repository'
import type { Barber, CustomerSubscription, MembershipPlan, NewMembershipPlan, RecurringBooking, Service } from '../types'
import { buttonStyles, Button } from './ui/Button'
import { Field, Input, Select } from './ui/Field'
import { FormRow, Group, InsetForm, Toggle } from './ui/FormParts'
import { cardStyles } from './ui/Card'
import { cn } from '../lib/cn'
import { Notice, SectionHeading } from './ui/Notice'
import { IconButton } from './ui/IconButton'
import { listRowStyles } from './ui/FormParts'

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
    <section className={cn(cardStyles, 'membership-panel')} aria-labelledby={`membership-${mode}`}>
      <SectionHeading eyebrow="Clube da barbearia" title={mode === 'customer' ? 'Sua assinatura de cliente' : 'Planos e assinantes'} id={`membership-${mode}`} aside={<CreditCard aria-hidden="true" />} className="mb-5" />
      <Notice>Esta assinatura liga o cliente à barbearia. Ela é diferente da assinatura da barbearia com a plataforma Meu Barbeiro.</Notice>
      {message && <Notice role="status">{message}</Notice>}

      {mode === 'customer' ? (
        <>
          {subscription ? (
            <div className={listRowStyles}>
              <div>
                <strong>{subscription.plan.name} · {subscription.status}</strong>
                <span>{subscription.visitsUsed} usadas · {Math.max(0, subscription.plan.includedVisits - subscription.visitsUsed)} restantes até {new Intl.DateTimeFormat('pt-BR').format(new Date(subscription.currentPeriodEnd))}</span>
              </div>
              {subscription.status !== 'CANCELLED' && <button className={buttonStyles({ variant: 'ghost', size: 'sm' })} disabled={busy} onClick={() => void act(() => repository.cancelCustomerSubscription(subscription.id), 'Assinatura cancelada. Os horários já criados continuam válidos.')}>Cancelar</button>}
            </div>
          ) : (
            <div className="grid">
              {plans.filter((plan) => plan.active).map((plan) => (
                <article className={listRowStyles} key={plan.id}>
                  <div><strong>{plan.name} · {formatCurrency(plan.priceCents / 100)}</strong><span>{plan.includedVisits} visita(s) a cada {plan.intervalDays} dias</span></div>
                  <button className={buttonStyles({ variant: 'primary', size: 'sm' })} disabled={busy} onClick={() => void act(async () => {
                    const result = await repository.subscribeMembership(plan.id)
                    if (result.checkoutUrl) window.location.assign(result.checkoutUrl)
                  }, 'Assinatura iniciada.')}>Assinar</button>
                </article>
              ))}
            </div>
          )}
          {subscription?.status === 'ACTIVE' && (
            <InsetForm title="Horário fixo" icon={<CalendarDays aria-hidden="true" />} onSubmit={createBooking}>
              <Field label="Serviço"><Select required value={bookingForm.serviceId} onChange={(event) => setBookingForm({ ...bookingForm, serviceId: event.target.value })}><option value="">Selecione</option>{services.filter((service) => subscription.plan.serviceIds.includes(service.id)).map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</Select></Field>
              <Field label="Profissional"><Select required value={bookingForm.barberId} onChange={(event) => setBookingForm({ ...bookingForm, barberId: event.target.value })}><option value="">Selecione</option>{barbers.map((barber) => <option value={barber.id} key={barber.id}>{barber.name}</option>)}</Select></Field>
              <FormRow>
                <Field label="Dia"><Select value={bookingForm.weekday} onChange={(event) => setBookingForm({ ...bookingForm, weekday: Number(event.target.value) })}>{weekdays.map((label, index) => <option value={index} key={label}>{label}</option>)}</Select></Field>
                <Field label="Hora"><Input type="time" required value={bookingForm.time} onChange={(event) => setBookingForm({ ...bookingForm, time: event.target.value })} /></Field>
              </FormRow>
              <Button type="submit" variant="dark" loading={busy} className="justify-self-start"><Plus aria-hidden="true" /> Criar horário fixo</Button>
            </InsetForm>
          )}
          {bookings.filter((booking) => booking.active).map((booking) => <div className={listRowStyles} key={booking.id}><div><strong>{weekdays[booking.weekday]} às {booking.time}</strong><span>{booking.barber?.name ?? 'Profissional definido'} · ocorrências futuras respeitam agenda e conflitos</span></div><IconButton tone="subtle" aria-label="Excluir horário fixo" disabled={busy} onClick={() => void act(() => repository.deleteRecurringBooking(booking.id), 'Horário fixo desativado. Agendamentos já criados foram mantidos.')}><Trash2 aria-hidden="true" /></IconButton></div>)}
        </>
      ) : (
        <>
          <InsetForm title="Novo plano" icon={<Plus aria-hidden="true" />} onSubmit={createPlan}>
            <Field label="Nome"><Input required minLength={3} value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} /></Field>
            <FormRow columns={3}>
              <Field label="Preço (R$)"><Input type="number" min="1" step="0.01" required value={planForm.priceCents ? planForm.priceCents / 100 : ''} onChange={(event) => setPlanForm({ ...planForm, priceCents: Math.round(Number(event.target.value) * 100) })} /></Field>
              <Field label="Período (dias)"><Input type="number" min="1" required value={planForm.intervalDays} onChange={(event) => setPlanForm({ ...planForm, intervalDays: Number(event.target.value) })} /></Field>
              <Field label="Visitas"><Input type="number" min="1" required value={planForm.includedVisits} onChange={(event) => setPlanForm({ ...planForm, includedVisits: Number(event.target.value) })} /></Field>
            </FormRow>
            <Group legend="Serviços cobertos">
              {services.map((service) => <Toggle key={service.id} checked={planForm.serviceIds.includes(service.id)} onChange={(checked) => setPlanForm({ ...planForm, serviceIds: checked ? [...planForm.serviceIds, service.id] : planForm.serviceIds.filter((id) => id !== service.id) })}>{service.name}</Toggle>)}
            </Group>
            <Button type="submit" variant="dark" loading={busy} disabled={planForm.serviceIds.length === 0} className="justify-self-start">Criar plano</Button>
          </InsetForm>
          <div className="grid">{plans.map((plan) => <div className={listRowStyles} key={plan.id}><div><strong>{plan.name} · {formatCurrency(plan.priceCents / 100)}</strong><span>{plan.includedVisits} visita(s) / {plan.intervalDays} dias · {plan.active ? 'ativo' : 'inativo'}</span></div></div>)}</div>
          <h3 className="mt-6 mb-1 font-serif text-lg font-medium">Assinantes</h3>
          {subscriptions.length === 0 ? <p className="text-sm text-muted">Nenhum assinante ainda.</p> : subscriptions.map((item) => <div className={listRowStyles} key={item.id}><div><strong>{item.user?.name ?? 'Cliente'} · {item.plan.name}</strong><span>{item.visitsUsed}/{item.plan.includedVisits} visitas usadas · {item.status}</span></div></div>)}
          <h3 className="mt-6 mb-1 font-serif text-lg font-medium">Ocorrências pendentes de resolução</h3>
          {pending.length === 0 ? <p className="text-sm text-muted">Nenhuma falha na geração dos horários fixos.</p> : pending.map(({ booking, occurrence }) => <div className={listRowStyles} key={occurrence.id}><div><strong>{booking.user?.name ?? 'Cliente'} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(occurrence.scheduledAt))}</strong><span>{occurrence.reason}</span></div></div>)}
        </>
      )}
    </section>
  )
}
