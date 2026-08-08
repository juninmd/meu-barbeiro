import { CalendarDays, Check, Clock3, MapPin, Scissors, Sparkles, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { StatusBadge } from '../../components/StatusBadge'
import { formatBusinessHours, formatCurrency, formatDate, paymentLabel } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { Appointment, AppointmentAvailability, Barber, Barbershop, NewAppointment, Service } from '../../types'

interface ClientDashboardProps {
  appointments: Appointment[]
  barbers: Barber[]
  barbershop: Barbershop | null
  services: Service[]
  onRefresh: () => Promise<void>
}

const dateInTimezone = (timezone: string) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function ClientDashboard({ appointments, barbers, barbershop, services, onRefresh }: ClientDashboardProps) {
  const [form, setForm] = useState<NewAppointment>({ barberId: '', serviceId: '', scheduledAt: '' })
  const [date, setDate] = useState('')
  const [availability, setAvailability] = useState<AppointmentAvailability | null>(null)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null)
  const [now, setNow] = useState(Date.now())
  const bookingPanel = useRef<HTMLElement>(null)
  const upcoming = appointments
    .filter((item) => item.status !== 'CANCELLED' && item.status !== 'DONE' && new Date(item.scheduledAt) >= new Date())
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const history = appointments.filter((item) => !upcoming.includes(item))
  const selectedService = services.find((item) => item.id === form.serviceId)
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const timezone = barbershop?.timezone || browserTimezone
  const slotPeriods = groupSlotsByPeriod(availability?.slots || [])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    setAvailability(null)
    setAvailabilityError(null)
    setForm((current) => ({ ...current, scheduledAt: '' }))
    if (!form.barberId || !form.serviceId || !date) {
      setLoadingAvailability(false)
      return
    }

    let active = true
    setLoadingAvailability(true)
    repository.availability(form.barberId, form.serviceId, date, rescheduleTarget?.id)
      .then((result) => {
        if (active) setAvailability(result)
      })
      .catch((error) => {
        if (active) setAvailabilityError(errorMessage(error, 'Não foi possível consultar os horários'))
      })
      .finally(() => {
        if (active) setLoadingAvailability(false)
      })
    return () => { active = false }
  }, [date, form.barberId, form.serviceId, rescheduleTarget?.id])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      if (rescheduleTarget) {
        await repository.rescheduleAppointment(rescheduleTarget.id, form.scheduledAt)
        setRescheduleTarget(null)
        setForm({ barberId: '', serviceId: '', scheduledAt: '' })
        setDate('')
        setMessage('Horário remarcado. O pagamento já feito continua valendo.')
        await onRefresh()
        return
      }

      const result = await repository.createAppointment(form)
      setForm({ barberId: '', serviceId: '', scheduledAt: '' })
      setDate('')
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl)
        return
      }
      setMessage(result.appointment.paymentStatus === 'APPROVED'
        ? 'Pagamento aprovado. O barbeiro já recebeu seu horário.'
        : 'Pedido enviado. O barbeiro já recebeu seu horário.')
      await onRefresh()
    } catch (error) {
      setMessage(errorMessage(error, rescheduleTarget ? 'Não foi possível remarcar' : 'Não foi possível agendar'))
    } finally {
      setBusy(false)
    }
  }

  const startReschedule = (appointment: Appointment) => {
    setRescheduleTarget(appointment)
    setForm({
      barberId: appointment.barberId,
      serviceId: appointment.serviceId,
      scheduledAt: '',
    })
    setDate('')
    setMessage(null)
    window.requestAnimationFrame(() => bookingPanel.current?.scrollIntoView({ behavior: 'smooth' }))
  }

  const stopReschedule = () => {
    setRescheduleTarget(null)
    setForm({ barberId: '', serviceId: '', scheduledAt: '' })
    setDate('')
  }

  const cancel = async () => {
    if (!cancelTarget) return
    setBusy(true)
    setMessage(null)
    try {
      await repository.updateAppointment(cancelTarget.id, 'CANCELLED')
      await onRefresh()
      setMessage(cancelTarget.paymentStatus === 'APPROVED'
        ? `Cancelamento concluído. O estorno do ${paymentLabel(cancelTarget.paymentAmount, cancelTarget.service.price).toLowerCase()} foi solicitado ao Mercado Pago.`
        : cancelTarget.paymentStatus === 'PENDING'
          ? 'Cancelamento concluído. A reserva foi liberada e nada será cobrado.'
          : 'Horário cancelado.')
      setCancelTarget(null)
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível cancelar'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
    <main id="top" className="page-wrap" inert={cancelTarget ? true : undefined} aria-hidden={cancelTarget ? true : undefined}>
      <section className="hero client-hero">
        <div>
          <p className="eyebrow"><Sparkles aria-hidden="true" /> Seu próximo visual</p>
          <h1>Reserve sua cadeira.</h1>
          <p>Escolha o serviço, o profissional e o melhor momento. Simples assim.</p>
        </div>
        <div className="hero-stamp" aria-label="Horários configurados pela barbearia">
          <span>AGENDE</span><strong>ONLINE</strong><small>com hora marcada</small>
        </div>
      </section>

      {message && <p className="form-message global-message" role="status">{message}</p>}

      <div className="client-grid">
        <section ref={bookingPanel} className="panel booking-panel" aria-labelledby="booking-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{rescheduleTarget ? 'Remarcar agendamento' : 'Novo agendamento'}</p>
              <h2 id="booking-title">{rescheduleTarget ? 'Escolha o novo horário' : 'Monte seu horário'}</h2>
            </div>
            <span className="step-count">3 passos</span>
          </div>
          {rescheduleTarget && (
            <p className="form-message" role="status">
              Serviço e barbeiro serão mantidos. O pagamento já feito continua valendo.
            </p>
          )}
          <form onSubmit={submit} className="booking-form">
            <fieldset className={rescheduleTarget ? 'reschedule-locked' : undefined} disabled={Boolean(rescheduleTarget)}>
              <legend><span>01</span> O que vamos fazer?</legend>
              <div className="choice-grid">
                {services.map((service) => (
                  <label className={`choice-card ${form.serviceId === service.id ? 'selected' : ''}`} key={service.id}>
                    <input
                      type="radio"
                      name="service"
                      value={service.id}
                      checked={form.serviceId === service.id}
                      onChange={(event) => setForm({ ...form, serviceId: event.target.value })}
                      required
                    />
                    <Scissors aria-hidden="true" />
                    <span><strong>{service.name}</strong><small>{service.duration} min · {formatCurrency(service.price)}</small></span>
                    {form.serviceId === service.id && <Check className="choice-check" aria-hidden="true" />}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className={rescheduleTarget ? 'reschedule-locked' : undefined} disabled={Boolean(rescheduleTarget)}>
              <legend><span>02</span> Com quem?</legend>
              <div className="choice-grid choice-grid-small">
                {barbers.map((barber) => (
                  <label className={`choice-card ${form.barberId === barber.id ? 'selected' : ''}`} key={barber.id}>
                    <input
                      type="radio"
                      name="barber"
                      value={barber.id}
                      checked={form.barberId === barber.id}
                      onChange={(event) => setForm({ ...form, barberId: event.target.value })}
                      required
                    />
                    <UserRound aria-hidden="true" />
                    <span><strong>{barber.name}</strong><small>{barber.specialty}</small></span>
                    {form.barberId === barber.id && <Check className="choice-check" aria-hidden="true" />}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend><span>03</span> Quando?</legend>
              <label className="date-field">
                <CalendarDays aria-hidden="true" />
                <span><strong>Data</strong><small>Duração estimada: {selectedService?.duration ?? '—'} min</small></span>
                <input
                  aria-label="Data"
                  type="date"
                  value={date}
                  min={dateInTimezone(timezone)}
                  onChange={(event) => setDate(event.target.value)}
                  required
                />
              </label>
              {loadingAvailability && <p className="availability-status" role="status">Carregando horários disponíveis…</p>}
              {!loadingAvailability && availabilityError && <p className="availability-status" role="status">{availabilityError}</p>}
              {!loadingAvailability && availability && (!availability.open || availability.slots.length === 0) && (
                <p className="availability-status" role="status">{availability.reason || 'Não há horários livres nesta data'}</p>
              )}
              {!loadingAvailability && availability?.open && availability.slots.length > 0 && (
                <div className="availability-block">
                  <div className="availability-heading">
                    <strong>Horários disponíveis</strong>
                    {availability.timezone !== browserTimezone && (
                      <small>horários no fuso da barbearia · {availability.timezone}</small>
                    )}
                  </div>
                  <div className="slot-periods" aria-label="Horários disponíveis">
                    {slotPeriods.map((period) => period.slots.length > 0 && (
                      <section className="slot-period" aria-labelledby={`slot-period-${period.key}`} key={period.key}>
                        <h4 id={`slot-period-${period.key}`}>{period.label}</h4>
                        <div className="slot-grid">
                          {period.slots.map((slot) => (
                            <button
                              aria-label={`Selecionar horário ${slot.label}`}
                              aria-pressed={form.scheduledAt === slot.scheduledAt}
                              className={`slot-button ${form.scheduledAt === slot.scheduledAt ? 'selected' : ''}`}
                              key={slot.scheduledAt}
                              onClick={() => setForm({ ...form, scheduledAt: slot.scheduledAt })}
                              type="button"
                            >
                              {slot.label}
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              )}
            </fieldset>

            <button className="button button-primary button-wide" disabled={busy || !form.scheduledAt}>
              {busy ? (rescheduleTarget ? 'Remarcando…' : 'Reservando…') : (rescheduleTarget ? 'Confirmar novo horário' : 'Solicitar agendamento')} <CalendarDays aria-hidden="true" />
            </button>
            {rescheduleTarget && (
              <button className="button button-ghost button-wide" disabled={busy} onClick={stopReschedule} type="button">
                Manter horário atual
              </button>
            )}
          </form>
        </section>

        <aside className="schedule-column">
          <section className="panel" aria-labelledby="upcoming-title">
            <div className="section-heading compact">
              <div><p className="eyebrow">Sua agenda</p><h2 id="upcoming-title">Próximos horários</h2></div>
              <span className="count-badge">{upcoming.length}</span>
            </div>
            <div className="appointment-list">
              {upcoming.length === 0 && <EmptyAppointments />}
              {upcoming.map((appointment) => (
                <article className="appointment-card" key={appointment.id}>
                  <div className="appointment-top"><StatusBadge status={appointment.status} /><time>{formatDate(appointment.scheduledAt)}</time></div>
                  <h3>{appointment.service.name}</h3>
                  <p><UserRound aria-hidden="true" /> {appointment.barber.name}</p>
                  <p><Clock3 aria-hidden="true" /> {appointment.service.duration} min · {formatCurrency(appointment.service.price)}</p>
                  {appointment.paymentStatus === 'PENDING' ? (
                    <div className="payment-warning">
                      {appointment.paymentExpiresAt && new Date(appointment.paymentExpiresAt).getTime() <= now ? (
                        <p><span aria-hidden="true">$</span> Reserva expirada. O horário não está mais reservado.</p>
                      ) : (
                        <>
                          <p><span aria-hidden="true">$</span> {paymentLabel(appointment.paymentAmount, appointment.service.price)} {formatCurrency(appointment.paymentAmount)} · pendente{appointment.paymentExpiresAt ? ` · ${paymentTimeLeft(appointment.paymentExpiresAt, now)}` : ''}</p>
                          <p>O horário só fica garantido após o pagamento.</p>
                        </>
                      )}
                    </div>
                  ) : appointment.paymentStatus !== 'NOT_REQUIRED' && (
                    <p><span aria-hidden="true">$</span> {paymentLabel(appointment.paymentAmount, appointment.service.price)} {formatCurrency(appointment.paymentAmount)} · {appointment.paymentStatus === 'APPROVED' ? 'pago' : appointment.paymentStatus === 'REFUNDED' ? 'estornado' : 'não aprovado'}</p>
                  )}
                  <div className="appointment-actions">
                    <button className="text-button" disabled={busy} onClick={() => startReschedule(appointment)}>
                      <CalendarDays aria-hidden="true" /> Remarcar
                    </button>
                    <button className="text-button danger" disabled={busy} onClick={() => setCancelTarget(appointment)}>
                      <X aria-hidden="true" /> Cancelar horário
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="location-card">
            <MapPin aria-hidden="true" />
            <div>
              <strong>{barbershop?.name || 'Barbearia'}</strong>
              <span>{barbershop?.address || 'Endereço informado no agendamento'}</span>
              {barbershop && <span>Expediente: {formatBusinessHours(barbershop.businessHours)}</span>}
            </div>
          </div>

          {history.length > 0 && (
            <details className="history">
              <summary>Ver histórico ({history.length})</summary>
              {history.map((item) => (
                <div className="history-item" key={item.id}>
                  <StatusBadge status={item.status} />
                  <p>{formatDate(item.scheduledAt)} · {item.service.name}</p>
                  {item.paymentStatus === 'REFUNDED' && <strong>Pagamento estornado</strong>}
                </div>
              ))}
            </details>
          )}
        </aside>
      </div>
    </main>
    {cancelTarget && (
      <ConfirmDialog
        eyebrow="Confirmar cancelamento"
        title="Cancelar este horário?"
        description={cancelDescription(cancelTarget)}
        cancelLabel="Manter horário"
        confirmLabel={busy ? 'Cancelando…' : 'Sim, cancelar'}
        busy={busy}
        onCancel={() => setCancelTarget(null)}
        onConfirm={cancel}
      />
    )}
    </>
  )
}

function groupSlotsByPeriod(slots: AppointmentAvailability['slots']) {
  const periods = [
    { key: 'morning', label: 'Manhã', start: 0, end: 12 },
    { key: 'afternoon', label: 'Tarde', start: 12, end: 18 },
    { key: 'night', label: 'Noite', start: 18, end: 24 },
  ]
  return periods.map((period) => ({
    ...period,
    slots: slots.filter((slot) => {
      const hour = Number(slot.label.slice(0, 2))
      return hour >= period.start && hour < period.end
    }),
  }))
}

function paymentTimeLeft(paymentExpiresAt: string, now: number) {
  const minutes = Math.max(1, Math.ceil((new Date(paymentExpiresAt).getTime() - now) / 60_000))
  return minutes === 1 ? 'resta 1 minuto para pagar' : `restam ${minutes} minutos para pagar`
}

function cancelDescription(appointment: Appointment) {
  if (appointment.paymentStatus === 'APPROVED') {
    return `O ${paymentLabel(appointment.paymentAmount, appointment.service.price).toLowerCase()} de ${formatCurrency(appointment.paymentAmount)} será estornado pelo Mercado Pago.`
  }
  if (appointment.paymentStatus === 'PENDING') {
    return 'A reserva será liberada e nada será cobrado.'
  }
  return 'Tem certeza de que deseja cancelar este horário?'
}

function EmptyAppointments() {
  return (
    <div className="empty-state">
      <CalendarDays aria-hidden="true" />
      <strong>Nenhum horário marcado</strong>
      <p>Seu próximo agendamento aparecerá aqui.</p>
    </div>
  )
}
