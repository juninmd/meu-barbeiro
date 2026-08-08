import { BellRing, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, MapPin, RotateCcw, Scissors, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { AppointmentSlots } from '../../components/AppointmentSlots'
import { StatusBadge } from '../../components/StatusBadge'
import { LoyaltyCardPanel } from '../../components/LoyaltyCardPanel'
import { formatBusinessHours, formatCurrency, formatDate, paymentLabel } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { Appointment, AppointmentAvailability, Barber, Barbershop, LastAppointment, NewAppointment, Service, User } from '../../types'

interface ClientDashboardProps {
  appointments: Appointment[]
  barbers: Barber[]
  barbershop: Barbershop | null
  currentUser: User
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

const formatShortDate = (date: string) => new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', timeZone: 'UTC',
}).format(new Date(`${date}T12:00:00.000Z`))

export function ClientDashboard({ appointments, barbers, barbershop, currentUser, services, onRefresh }: ClientDashboardProps) {
  const { section } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState<NewAppointment>({ barberId: '', serviceId: '', scheduledAt: '' })
  const [bookingStep, setBookingStep] = useState(1)
  const [date, setDate] = useState('')
  const [availability, setAvailability] = useState<AppointmentAvailability | null>(null)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [availabilityRevision, setAvailabilityRevision] = useState(0)
  const [barbersRevision, setBarbersRevision] = useState(0)
  const [datedBarbers, setDatedBarbers] = useState<Barber[]>([])
  const [loadingBarbers, setLoadingBarbers] = useState(false)
  const [barbersError, setBarbersError] = useState<string | null>(null)
  const [waitlistRequested, setWaitlistRequested] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null)
  const [now, setNow] = useState(Date.now())
  const [lastAppointment, setLastAppointment] = useState<LastAppointment | null>(null)
  const bookingPanel = useRef<HTMLElement>(null)
  const upcoming = appointments
    .filter((item) => item.status !== 'CANCELLED' && item.status !== 'DONE' && new Date(item.scheduledAt) >= new Date())
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const history = appointments.filter((item) => !upcoming.includes(item))
  const selectedService = services.find((item) => item.id === form.serviceId)
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const timezone = barbershop?.timezone || browserTimezone
  const availableBarbers = datedBarbers.filter((barber) => barber.available)
  const nextAvailableDate = datedBarbers
    .map((barber) => barber.nextAvailableDate)
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? null

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    let active = true
    repository.lastAppointment()
      .then((result) => { if (active) setLastAppointment(result) })
      .catch(() => { if (active) setLastAppointment(null) })
    return () => { active = false }
  }, [appointments])

  useEffect(() => {
    setDatedBarbers([])
    setBarbersError(null)
    setWaitlistRequested(false)
    if (!date || !form.serviceId || rescheduleTarget) {
      setLoadingBarbers(false)
      return
    }

    let active = true
    setLoadingBarbers(true)
    repository.barbers(date, [form.serviceId])
      .then((result) => {
        if (!active) return
        setDatedBarbers(result)
        setForm((current) => {
          if (current.barberId === 'any' && result.some((barber) => barber.available)) return current
          if (result.some((barber) => barber.id === current.barberId && barber.available)) return current
          return { ...current, barberId: '', scheduledAt: '' }
        })
      })
      .catch((error) => {
        if (active) setBarbersError(errorMessage(error, 'Não foi possível consultar os barbeiros'))
      })
      .finally(() => {
        if (active) setLoadingBarbers(false)
      })
    return () => { active = false }
  }, [barbersRevision, date, form.serviceId, rescheduleTarget])

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
  }, [availabilityRevision, date, form.barberId, form.serviceId, rescheduleTarget?.id])

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
        setBookingStep(1)
        setMessage('Horário remarcado. O pagamento já feito continua valendo.')
        await onRefresh()
        navigate('/cliente/horarios')
        return
      }

      const result = await repository.createAppointment(form)
      setForm({ barberId: '', serviceId: '', scheduledAt: '' })
      setDate('')
      setBookingStep(1)
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl)
        return
      }
      setMessage(result.appointment.paymentStatus === 'APPROVED'
        ? 'Pagamento aprovado. O barbeiro já recebeu seu horário.'
        : 'Pedido enviado. O barbeiro já recebeu seu horário.')
      await onRefresh()
      navigate('/cliente/horarios')
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
    setBookingStep(2)
    navigate('/cliente/agendar')
    window.requestAnimationFrame(() => bookingPanel.current?.scrollIntoView({ behavior: 'smooth' }))
  }

  const repeatLastAppointment = () => {
    if (!lastAppointment?.repeatable
      || !services.some((service) => service.id === lastAppointment.service.id)
      || !barbers.some((barber) => barber.id === lastAppointment.barber.id)) {
      setForm({ barberId: '', serviceId: '', scheduledAt: '' })
      setDate('')
      setMessage(lastAppointment?.unavailableReason || 'O último atendimento mudou. Escolha novamente o serviço e o barbeiro.')
    } else {
      setForm({ barberId: lastAppointment.barber.id, serviceId: lastAppointment.service.id, scheduledAt: '' })
      setDate('')
      setMessage('Serviço e barbeiro preenchidos. Agora escolha a data.')
    }
    setBookingStep(lastAppointment?.repeatable ? 2 : 1)
    window.requestAnimationFrame(() => bookingPanel.current?.scrollIntoView({ behavior: 'smooth' }))
  }

  const stopReschedule = () => {
    setRescheduleTarget(null)
    setForm({ barberId: '', serviceId: '', scheduledAt: '' })
    setDate('')
    setBookingStep(1)
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

  if (!section || !['agendar', 'horarios', 'perfil'].includes(section)) {
    return <Navigate replace to={upcoming.length > 0 ? '/cliente/horarios' : '/cliente/agendar'} />
  }

  const appointmentCard = (appointment: Appointment, spotlight = false) => (
    <article className={`appointment-card ${spotlight ? 'appointment-spotlight' : ''}`} data-testid={spotlight ? 'client-next-appointment' : undefined} key={appointment.id}>
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
  )

  return (
    <>
    <main id="top" className="page-wrap section-page" data-section={section} inert={cancelTarget ? true : undefined} aria-hidden={cancelTarget ? true : undefined}>
      {message && <p className="form-message global-message" role="status">{message}</p>}

      {section === 'agendar' && (
        <>
        <header className="page-heading">
          <p className="eyebrow">Novo horário</p>
          <h1>Reserve sua cadeira.</h1>
          <p>Três escolhas rápidas. Seu horário fica visível antes do formulário quando já existe uma reserva.</p>
        </header>
        {upcoming[0] && (
          <section className="panel next-appointment-summary" aria-labelledby="next-before-booking">
            <div className="section-heading compact">
              <div><p className="eyebrow">Antes de agendar outro</p><h2 id="next-before-booking">Seu próximo horário</h2></div>
              <Link className="button button-ghost button-small" to="/cliente/horarios">Ver agenda</Link>
            </div>
            {appointmentCard(upcoming[0], true)}
          </section>
        )}
        <section ref={bookingPanel} className="panel booking-panel" data-testid="booking-form" aria-labelledby="booking-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{rescheduleTarget ? 'Remarcar agendamento' : 'Novo agendamento'}</p>
              <h2 id="booking-title">{rescheduleTarget ? 'Escolha o novo horário' : 'Monte seu horário'}</h2>
            </div>
            <span className="step-count">Passo {bookingStep} de 3</span>
          </div>
          <ol className="booking-progress" aria-label="Progresso do agendamento">
            {['Serviço', 'Data', 'Barbeiro e horário'].map((label, index) => (
              <li className={bookingStep === index + 1 ? 'current' : bookingStep > index + 1 ? 'complete' : ''} aria-current={bookingStep === index + 1 ? 'step' : undefined} key={label}>
                <span>{index + 1}</span>{label}
              </li>
            ))}
          </ol>
          {rescheduleTarget && (
            <p className="form-message" role="status">
              Serviço e barbeiro serão mantidos. O pagamento já feito continua valendo.
            </p>
          )}
          {!rescheduleTarget && lastAppointment && (
            <div className="repeat-booking">
              <div><strong>{lastAppointment.service.name}</strong><span>com {lastAppointment.barber.name}</span></div>
              <button className="button button-small button-dark" type="button" onClick={repeatLastAppointment}><RotateCcw aria-hidden="true" /> Repetir último atendimento</button>
            </div>
          )}
          <form onSubmit={submit} className="booking-form">
            {bookingStep === 1 && <fieldset>
              <legend><span>01</span> O que vamos fazer?</legend>
              <div className="choice-grid">
                {services.length === 0 && (
                  <div className="empty-state"><Scissors aria-hidden="true" /><strong>Nenhum serviço disponível</strong><p>Tente carregar o catálogo novamente.</p><button className="button button-ghost" type="button" onClick={() => void onRefresh()}>Tentar novamente</button></div>
                )}
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
            </fieldset>}

            {bookingStep === 2 && <fieldset>
              <legend><span>02</span> Quando?</legend>
              <label className="date-field">
                <CalendarDays aria-hidden="true" />
                <span><strong>Data</strong><small>Duração estimada: {selectedService?.duration ?? '—'} min</small></span>
                <input
                  aria-label="Data"
                  type="date"
                  value={date}
                  min={dateInTimezone(timezone)}
                  onChange={(event) => {
                    setDate(event.target.value)
                    setForm((current) => ({ ...current, barberId: rescheduleTarget ? current.barberId : '', scheduledAt: '' }))
                  }}
                  required
                />
              </label>
              {loadingBarbers && <p className="availability-status" role="status">Consultando quem atende nesta data…</p>}
              {barbersError && <div className="empty-state"><strong>Não foi possível consultar os barbeiros</strong><p>{barbersError}</p><button className="button button-ghost" type="button" onClick={() => setBarbersRevision((revision) => revision + 1)}>Tentar novamente</button></div>}
            </fieldset>}

            {bookingStep === 3 && <fieldset>
              <legend><span>03</span> Com quem?</legend>
              {rescheduleTarget ? (
                <p className="form-message">Barbeiro mantido na remarcação. Escolha um novo horário disponível.</p>
              ) : loadingBarbers ? (
                <p className="availability-status" role="status">Consultando quem atende nesta data…</p>
              ) : barbersError ? (
                <div className="empty-state"><strong>Não foi possível consultar os barbeiros</strong><p>{barbersError}</p><button className="button button-ghost" type="button" onClick={() => setBarbersRevision((revision) => revision + 1)}>Tentar novamente</button></div>
              ) : availableBarbers.length === 0 ? (
                <div className="empty-state barber-empty-state">
                  <UserRound aria-hidden="true" />
                  <strong>Ninguém disponível nesta data</strong>
                  <p>{nextAvailableDate ? `O próximo dia com atendimento é ${formatShortDate(nextAvailableDate)}.` : 'Não encontramos atendimento nos próximos 60 dias.'}</p>
                  {nextAvailableDate && <button className="button button-primary" type="button" onClick={() => setDate(nextAvailableDate)}>Ver próximo dia</button>}
                  <button className="button button-ghost" type="button" onClick={() => setWaitlistRequested(true)}>Entrar na fila de espera</button>
                  {waitlistRequested && <p className="form-message" role="status">Interesse registrado para esta data. A barbearia poderá avisar quando surgir um horário.</p>}
                </div>
              ) : (
              <div className="choice-grid choice-grid-small">
                <label className={`choice-card any-barber-card ${availableBarbers.length > 1 ? 'recommended' : ''} ${form.barberId === 'any' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="barber"
                    value="any"
                    checked={form.barberId === 'any'}
                    onChange={(event) => setForm({ ...form, barberId: event.target.value })}
                    required
                  />
                  <UserRound aria-hidden="true" />
                  <span><strong>Qualquer barbeiro disponível</strong><small>{availableBarbers.length > 1 ? 'Mais opções de horário para você' : 'Primeiro horário disponível'}</small></span>
                  {form.barberId === 'any' && <Check className="choice-check" aria-hidden="true" />}
                </label>
                {datedBarbers.map((barber) => (
                  <label className={`choice-card ${barber.available ? '' : 'unavailable'} ${form.barberId === barber.id ? 'selected' : ''}`} key={barber.id}>
                    <input
                      type="radio"
                      name="barber"
                      value={barber.id}
                      checked={form.barberId === barber.id}
                      onChange={(event) => setForm({ ...form, barberId: event.target.value })}
                      disabled={!barber.available}
                      required
                    />
                    <UserRound aria-hidden="true" />
                    <span>
                      <strong>{barber.name}</strong>
                      <small>{barber.available
                        ? `${barber.slotCount} horário${barber.slotCount === 1 ? '' : 's'} · primeiro às ${barber.firstAvailableTime}`
                        : `${barber.unavailableReason}${barber.nextAvailableDate ? ` · atende em ${formatShortDate(barber.nextAvailableDate)}` : ''}`}</small>
                    </span>
                    {form.barberId === barber.id && <Check className="choice-check" aria-hidden="true" />}
                  </label>
                ))}
              </div>
              )}
              <AppointmentSlots
                availability={availability}
                error={availabilityError}
                loading={loadingAvailability}
                selected={form.scheduledAt}
                browserTimezone={browserTimezone}
                onSelect={(scheduledAt) => setForm({ ...form, scheduledAt })}
                onRetry={() => setAvailabilityRevision((revision) => revision + 1)}
              />
            </fieldset>}

            <div className="form-action-bar">
              {bookingStep > 1 && !rescheduleTarget && <button className="button button-ghost" type="button" onClick={() => setBookingStep((step) => step - 1)}><ChevronLeft aria-hidden="true" /> Voltar</button>}
              {bookingStep < 3 ? (
                <button className="button button-primary" type="button" disabled={bookingStep === 1 ? !form.serviceId : !date || loadingBarbers || Boolean(barbersError)} onClick={() => setBookingStep((step) => step + 1)}>Continuar <ChevronRight aria-hidden="true" /></button>
              ) : (
                <button className="button button-primary" disabled={busy || !form.scheduledAt}>
                  {busy ? (rescheduleTarget ? 'Remarcando…' : 'Reservando…') : (rescheduleTarget ? 'Confirmar novo horário' : 'Solicitar agendamento')} <CalendarDays aria-hidden="true" />
                </button>
              )}
              {rescheduleTarget && <button className="button button-ghost" disabled={busy} onClick={stopReschedule} type="button">Manter horário atual</button>}
            </div>
          </form>
        </section>
        </>
      )}

      {section === 'horarios' && (
        <>
          <header className="page-heading">
            <p className="eyebrow">Sua agenda</p>
            <h1>{upcoming.length > 0 ? 'Seu próximo horário.' : 'Nenhum horário marcado.'}</h1>
            <p>{upcoming.length > 0 ? 'Confira os detalhes ou ajuste a reserva sem procurar pela página.' : 'Escolha um serviço e garanta sua cadeira.'}</p>
          </header>
          <section className="panel appointments-section" aria-labelledby="upcoming-title">
            <div className="section-heading compact">
              <div><p className="eyebrow">Confirmados e pendentes</p><h2 id="upcoming-title">Próximos horários</h2></div>
              <span className="count-badge">{upcoming.length}</span>
            </div>
            <div className="appointment-list">
              {upcoming.length === 0 && <EmptyAppointments />}
              {upcoming.map((appointment, index) => appointmentCard(appointment, index === 0))}
            </div>
            <Link className="button button-primary section-primary-action" to="/cliente/agendar"><CalendarDays aria-hidden="true" /> {upcoming.length > 0 ? 'Agendar outro horário' : 'Agendar agora'}</Link>
          </section>
          {history.length > 0 && (
            <details className="history panel">
              <summary>Ver histórico ({history.length})</summary>
              {history.map((item) => (
                <div className="history-item" key={item.id}>
                  <StatusBadge status={item.status} />
                  <p>{formatDate(item.scheduledAt)} · {item.service.name}</p>
                  {item.paymentStatus === 'REFUNDED' && <strong>Pagamento estornado</strong>}
                  {item.depositRetained && <strong>Falta registrada · sinal pago retido</strong>}
                </div>
              ))}
            </details>
          )}
          {history.length === 0 && <p className="empty-copy">Seu histórico aparecerá aqui depois do primeiro atendimento concluído ou cancelado.</p>}
        </>
      )}

      {section === 'perfil' && (
        <>
          <header className="page-heading"><p className="eyebrow">Seu perfil</p><h1>Preferências e benefícios.</h1><p>Fidelidade, endereço e lembretes em um só lugar.</p></header>
          <div className="profile-grid">
            <LoyaltyCardPanel />
            <div className="location-card">
            <MapPin aria-hidden="true" />
            <div>
              <strong>{barbershop?.name || 'Barbearia'}</strong>
              <span>{barbershop?.address || 'Endereço informado no agendamento'}</span>
              {barbershop && <span>Expediente: {formatBusinessHours(barbershop.businessHours)}</span>}
            </div>
          </div>
            <div className="location-card">
            <BellRing aria-hidden="true" />
            <div>
              <strong>Avisos do seu horário</strong>
              {barbershop?.remindersEnabled === false ? (
                <span>Esta barbearia não está enviando lembretes automáticos.</span>
              ) : currentUser.telegramId ? (
                <span>Você recebe pelo Telegram {reminderSchedule(barbershop?.reminderHoursBefore)} antes do atendimento.</span>
              ) : (
                <span>Seu Telegram não está vinculado. Peça à barbearia para associar sua conta; sem o vínculo, o aviso não pode ser enviado.</span>
              )}
            </div>
          </div>
          </div>
        </>
      )}
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

const reminderSchedule = (hours: number[] | undefined) => [...(hours ?? [24, 2])]
  .sort((left, right) => right - left)
  .map((hour) => hour === 24 ? '24 horas' : `${hour} horas`)
  .join(' e ')

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
