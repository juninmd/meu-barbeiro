import { BellRing, CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, RotateCcw, Scissors, Star, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Calendar } from '../../components/ui/Calendar'
import { MyPackages } from '../../components/CustomerPackages'
import { ReviewDialog } from '../../components/ReviewDialog'
import { Stars } from '../../components/ui/Stars'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { AppointmentSlots } from '../../components/AppointmentSlots'
import { StatusBadge } from '../../components/StatusBadge'
import { LoyaltyCardPanel } from '../../components/LoyaltyCardPanel'
import { WalkInQueuePanel } from '../../components/WalkInQueuePanel'
import { MembershipPanel } from '../../components/MembershipPanel'
import { formatBusinessHours, formatCurrency, formatDate, paymentLabel } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { Appointment, AppointmentAvailability, Barber, Barbershop, CancellationQuote, LastAppointment, MyReview, NewAppointment, Service, User } from '../../types'
import { Badge } from '../../components/ui/Badge'
import { buttonStyles, Button } from '../../components/ui/Button'
import { ActionBar, ChoiceCard, StepFieldset, Stepper } from '../../components/ui/Choice'
import { Notice, SectionHeading } from '../../components/ui/Notice'
import { cardStyles } from '../../components/ui/Card'
import { cn } from '../../lib/cn'
import { CountBadge, EmptyState } from '../../components/ui/EmptyState'
import { PageHeading, PageWrap } from '../../components/ui/Page'
import { TextButton } from '../../components/ui/IconButton'

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

const formatPickedDate = (date: string) => format(new Date(`${date}T12:00:00`), "EEEE, d 'de' MMMM", { locale: ptBR })

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
  const [myReviews, setMyReviews] = useState<MyReview[]>([])
  const [reviewTarget, setReviewTarget] = useState<Appointment | null>(null)
  const [cancelQuote, setCancelQuote] = useState<CancellationQuote | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null)
  const [now, setNow] = useState(Date.now())
  const [lastAppointment, setLastAppointment] = useState<LastAppointment | null>(null)
  const [membershipVisit, setMembershipVisit] = useState<{ covered: boolean; remainingVisits: number } | null>(null)
  const bookingPanel = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!form.serviceId || rescheduleTarget) { setMembershipVisit(null); return }
    let active = true
    void repository.membershipBenefit(form.serviceId).then((benefit) => { if (active) setMembershipVisit(benefit) })
      .catch(() => { if (active) setMembershipVisit(null) })
    return () => { active = false }
  }, [form.serviceId, rescheduleTarget])
  const upcoming = appointments
    .filter((item) => item.status !== 'CANCELLED' && item.status !== 'DONE' && new Date(item.scheduledAt) >= new Date())
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const history = appointments.filter((item) => !upcoming.includes(item))
  const selectedService = services.find((item) => item.id === form.serviceId)
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const timezone = barbershop?.timezone || browserTimezone
  const closedWeekdays = (barbershop?.businessHours ?? []).filter((hour) => !hour.enabled).map((hour) => hour.weekday)
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
      await repository.updateAppointment(cancelTarget.id, 'CANCELLED', cancelReason)
      await onRefresh()
      setMessage(cancelQuote
        ? `Cancelamento concluído. Estorno: ${formatCurrency(cancelQuote.refundedCents / 100)}. Retenção: ${formatCurrency(cancelQuote.feeCents / 100)}.`
        : cancelTarget.paymentStatus === 'PENDING'
          ? 'Cancelamento concluído. A reserva foi liberada e nada será cobrado.'
          : 'Horário cancelado.')
      setCancelTarget(null)
    } catch (error) {
      setCancelError(errorMessage(error, 'Não foi possível cancelar'))
    } finally {
      setBusy(false)
    }
  }

  const openCancellation = async (appointment: Appointment) => {
    setBusy(true)
    setMessage(null)
    try {
      setCancelQuote(await repository.cancellationPreview(appointment.id))
      setCancelReason('')
      setCancelError(null)
      setCancelTarget(appointment)
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível calcular o cancelamento'))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (section !== 'horarios') return
    let active = true
    repository.myReviews().then((value) => active && setMyReviews(value)).catch(() => undefined)
    return () => { active = false }
  }, [section])

  if (!section || !['agendar', 'horarios', 'perfil'].includes(section)) {
    return <Navigate replace to={upcoming.length > 0 ? '/cliente/horarios' : '/cliente/agendar'} />
  }

  const appointmentCard = (appointment: Appointment, spotlight = false) => (
    <article className={cn('border-t border-line py-4 first:border-t-0 first:pt-0 [&_p]:mb-1.5 [&_p]:flex [&_p]:items-center [&_p]:gap-1.5 [&_p]:text-xs [&_p]:text-muted', spotlight && 'border-0 p-0')} data-testid={spotlight ? 'client-next-appointment' : undefined} key={appointment.id}>
      <div className="flex items-center justify-between gap-2 [&_time]:text-xs [&_time]:text-muted"><StatusBadge status={appointment.status} /><time>{formatDate(appointment.scheduledAt)}</time></div>
      <h3 className="mt-3 mb-1.5 font-serif text-[1.15rem] font-medium">{appointment.service.name}</h3>
      <p><UserRound aria-hidden="true" /> {appointment.barber.name}</p>
      <p><Clock3 aria-hidden="true" /> {appointment.service.duration} min · {formatCurrency(appointment.service.price)}</p>
      {appointment.paymentStatus === 'PENDING' ? (
        <div className="my-2.5 rounded-r-lg border-l-[3px] border-brand bg-tint p-2.5 text-tint-ink [&_p]:text-tint-ink [&_p:last-child]:mb-0">
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <TextButton disabled={busy} onClick={() => startReschedule(appointment)}>
          <CalendarDays aria-hidden="true" /> Remarcar
        </TextButton>
        <TextButton tone="danger" disabled={busy} onClick={() => void openCancellation(appointment)}>
          <X aria-hidden="true" /> Cancelar horário
        </TextButton>
      </div>
    </article>
  )

  return (
    <>
    <PageWrap id="top" data-section={section} inert={cancelTarget ? true : undefined} aria-hidden={cancelTarget ? true : undefined}>
      {message && <Notice role="status">{message}</Notice>}
      <WalkInQueuePanel hideWhenEmpty />

      {section === 'agendar' && (
        <>
        <PageHeading eyebrow="Novo horário" title="Reserve sua cadeira.">Três escolhas rápidas. Seu horário fica visível antes do formulário quando já existe uma reserva.</PageHeading>
        {upcoming[0] && (
          <section className={cardStyles} aria-labelledby="next-before-booking">
            <SectionHeading eyebrow="Antes de agendar outro" title="Seu próximo horário" id="next-before-booking" aside={<Link className={buttonStyles({ variant: 'ghost', size: 'sm' })} to="/cliente/horarios">Ver agenda</Link>} className="mb-5" />
            {appointmentCard(upcoming[0], true)}
          </section>
        )}
        <section ref={bookingPanel} className={cn(cardStyles, 'grid gap-5 max-sm:pb-24')} data-testid="booking-form" aria-labelledby="booking-title">
          <SectionHeading
            eyebrow={rescheduleTarget ? 'Remarcar agendamento' : 'Novo agendamento'}
            title={rescheduleTarget ? 'Escolha o novo horário' : 'Monte seu horário'}
            id="booking-title"
            aside={<Badge tone="warning">Passo {bookingStep} de 3</Badge>}
          />
          <Stepper label="Progresso do agendamento" steps={['Serviço', 'Data', 'Barbeiro e horário']} current={bookingStep} />
          {rescheduleTarget && (
            <Notice role="status">
              Serviço e barbeiro serão mantidos. O pagamento já feito continua valendo.
            </Notice>
          )}
          {!rescheduleTarget && lastAppointment && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 p-4">
              <div className="grid gap-0.5"><strong>{lastAppointment.service.name}</strong><span className="text-sm text-muted">com {lastAppointment.barber.name}</span></div>
              <Button variant="dark" size="sm" onClick={repeatLastAppointment}><RotateCcw aria-hidden="true" /> Repetir último atendimento</Button>
            </div>
          )}
          <form onSubmit={submit} className="grid gap-8">
            {bookingStep === 1 && <StepFieldset step="01" title="O que vamos fazer?">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {services.length === 0 && (
                  <EmptyState><Scissors aria-hidden="true" /><strong>Nenhum serviço disponível</strong><p>Tente carregar o catálogo novamente.</p><button className={buttonStyles({ variant: 'ghost' })} type="button" onClick={() => void onRefresh()}>Tentar novamente</button></EmptyState>
                )}
                {services.map((service) => (
                  <ChoiceCard
                    key={service.id}
                    name="service"
                    value={service.id}
                    checked={form.serviceId === service.id}
                    onChange={(event) => setForm({ ...form, serviceId: event.target.value })}
                    required
                    icon={<Scissors />}
                    title={service.name}
                    hint={`${service.duration} min · ${formatCurrency(service.price)}`}
                  />
                ))}
              </div>
              {membershipVisit && <Notice role="status">{membershipVisit.covered ? `Esta visita está incluída na sua assinatura: nenhum sinal será cobrado. Depois dela, restará(ão) ${Math.max(0, membershipVisit.remainingVisits - 1)} visita(s).` : 'Esta visita não está incluída ou o limite do período acabou. A política normal de sinal será aplicada.'}</Notice>}
            </StepFieldset>}

            {bookingStep === 2 && <StepFieldset step="02" title="Quando?">
              <div className="grid gap-3.5 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5" data-testid="date-picker">
                <p className="flex items-center gap-3.5 rounded-xl bg-gradient-to-br from-tint to-brand-light/40 px-4 py-3.5">
                  <CalendarDays className="size-6 shrink-0 text-brand-deep" aria-hidden="true" />
                  <span className="grid"><strong className="font-serif text-lg font-medium first-letter:uppercase">{date ? formatPickedDate(date) : 'Escolha um dia'}</strong><small className="text-xs text-tint-ink/80">Duração estimada: {selectedService?.duration ?? '—'} min</small></span>
                </p>
                <Calendar
                  mode="single"
                  selected={date ? new Date(`${date}T12:00:00`) : undefined}
                  defaultMonth={date ? new Date(`${date}T12:00:00`) : new Date(`${dateInTimezone(timezone)}T12:00:00`)}
                  disabled={{ before: new Date(`${dateInTimezone(timezone)}T12:00:00`) }}
                  modifiers={{ closed: { dayOfWeek: closedWeekdays } }}
                  modifiersClassNames={{ closed: '[&>button]:text-muted [&>button]:line-through' }}
                  onSelect={(picked) => {
                    if (!picked) return
                    setDate(format(picked, 'yyyy-MM-dd'))
                    setForm((current) => ({ ...current, barberId: rescheduleTarget ? current.barberId : '', scheduledAt: '' }))
                  }}
                />
                {closedWeekdays.length > 0 && <small className="text-center text-xs text-muted">Dias riscados: a barbearia não abre.</small>}
              </div>
              {loadingBarbers && <p className="text-xs text-muted" role="status">Consultando quem atende nesta data…</p>}
              {barbersError && <EmptyState><strong>Não foi possível consultar os barbeiros</strong><p>{barbersError}</p><button className={buttonStyles({ variant: 'ghost' })} type="button" onClick={() => setBarbersRevision((revision) => revision + 1)}>Tentar novamente</button></EmptyState>}
            </StepFieldset>}

            {bookingStep === 3 && <StepFieldset step="03" title="Com quem?">
              {rescheduleTarget ? (
                <Notice>Barbeiro mantido na remarcação. Escolha um novo horário disponível.</Notice>
              ) : loadingBarbers ? (
                <p className="text-xs text-muted" role="status">Consultando quem atende nesta data…</p>
              ) : barbersError ? (
                <EmptyState><strong>Não foi possível consultar os barbeiros</strong><p>{barbersError}</p><button className={buttonStyles({ variant: 'ghost' })} type="button" onClick={() => setBarbersRevision((revision) => revision + 1)}>Tentar novamente</button></EmptyState>
              ) : availableBarbers.length === 0 ? (
                <EmptyState className="col-span-full">
                  <UserRound aria-hidden="true" />
                  <strong>Ninguém disponível nesta data</strong>
                  <p>{nextAvailableDate ? `O próximo dia com atendimento é ${formatShortDate(nextAvailableDate)}.` : 'Não encontramos atendimento nos próximos 60 dias.'}</p>
                  {nextAvailableDate && <button className={buttonStyles({ variant: 'primary' })} type="button" onClick={() => setDate(nextAvailableDate)}>Ver próximo dia</button>}
                  <button className={buttonStyles({ variant: 'ghost' })} type="button" onClick={() => setWaitlistRequested(true)}>Entrar na fila de espera</button>
                  {waitlistRequested && <Notice role="status">Interesse registrado para esta data. A barbearia poderá avisar quando surgir um horário.</Notice>}
                </EmptyState>
              ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceCard
                  name="barber"
                  value="any"
                  checked={form.barberId === 'any'}
                  onChange={(event) => setForm({ ...form, barberId: event.target.value })}
                  required
                  recommended={availableBarbers.length > 1}
                  icon={<UserRound />}
                  title="Qualquer barbeiro disponível"
                  hint={availableBarbers.length > 1 ? 'Mais opções de horário para você' : 'Primeiro horário disponível'}
                />
                {datedBarbers.map((barber) => (
                  <ChoiceCard
                    key={barber.id}
                    name="barber"
                    value={barber.id}
                    checked={form.barberId === barber.id}
                    onChange={(event) => setForm({ ...form, barberId: event.target.value })}
                    disabled={!barber.available}
                    required
                    icon={<UserRound />}
                    title={barber.name}
                    hint={barber.available
                      ? `${barber.slotCount} horário${barber.slotCount === 1 ? '' : 's'} · primeiro às ${barber.firstAvailableTime}`
                      : `${barber.unavailableReason}${barber.nextAvailableDate ? ` · atende em ${formatShortDate(barber.nextAvailableDate)}` : ''}`}
                  />
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
            </StepFieldset>}

            <ActionBar>
              {bookingStep > 1 && !rescheduleTarget && <button className={buttonStyles({ variant: 'ghost' })} type="button" onClick={() => setBookingStep((step) => step - 1)}><ChevronLeft aria-hidden="true" /> Voltar</button>}
              {bookingStep < 3 ? (
                <button className={buttonStyles({ variant: 'primary' })} type="button" disabled={bookingStep === 1 ? !form.serviceId : !date || loadingBarbers || Boolean(barbersError)} onClick={() => setBookingStep((step) => step + 1)}>Continuar <ChevronRight aria-hidden="true" /></button>
              ) : (
                <button className={buttonStyles({ variant: 'primary' })} disabled={busy || !form.scheduledAt}>
                  {busy ? (rescheduleTarget ? 'Remarcando…' : 'Reservando…') : (rescheduleTarget ? 'Confirmar novo horário' : 'Solicitar agendamento')} <CalendarDays aria-hidden="true" />
                </button>
              )}
              {rescheduleTarget && <button className={buttonStyles({ variant: 'ghost' })} disabled={busy} onClick={stopReschedule} type="button">Manter horário atual</button>}
            </ActionBar>
          </form>
        </section>
        </>
      )}

      {section === 'horarios' && (
        <>
          <PageHeading eyebrow="Sua agenda" title={upcoming.length > 0 ? 'Seu próximo horário.' : 'Nenhum horário marcado.'}>{upcoming.length > 0 ? 'Confira os detalhes ou ajuste a reserva sem procurar pela página.' : 'Escolha um serviço e garanta sua cadeira.'}</PageHeading>
          <section className={cn(cardStyles, 'max-w-[820px]')} aria-labelledby="upcoming-title">
            <SectionHeading eyebrow="Confirmados e pendentes" title="Próximos horários" id="upcoming-title" aside={<CountBadge>{upcoming.length}</CountBadge>} className="mb-5" />
            <div className="grid gap-3.5">
              {upcoming.length === 0 && <EmptyAppointments />}
              {upcoming.map((appointment, index) => appointmentCard(appointment, index === 0))}
            </div>
            <Link className={cn(buttonStyles({ variant: 'primary' }), 'mt-5 w-fit no-underline')} to="/cliente/agendar"><CalendarDays aria-hidden="true" /> {upcoming.length > 0 ? 'Agendar outro horário' : 'Agendar agora'}</Link>
          </section>
          {history.length > 0 && (
            <details className={cn(cardStyles, 'rounded-xl border-dashed text-xs text-muted [&_summary]:cursor-pointer [&_summary]:text-sm [&_summary]:font-bold [&_summary]:text-ink')}>
              <summary>Ver histórico ({history.length})</summary>
              {history.map((item) => (
                <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1 [&_p]:m-0 [&>strong]:col-start-2 [&>strong]:text-[.68rem] [&>strong]:text-danger" data-testid="history-item" key={item.id}>
                  <StatusBadge status={item.status} />
                  <p>{formatDate(item.scheduledAt)} · {item.service.name}</p>
                  {item.paymentStatus === 'REFUNDED' && <strong>Pagamento estornado</strong>}
                  {item.depositRetained && <strong>Falta registrada · sinal pago retido</strong>}
                  {item.status === 'DONE' && (() => {
                    const review = myReviews.find((entry) => entry.appointmentId === item.id)
                    return review
                      ? <span className="review-line"><Stars value={review.rating} label={`Sua nota: ${review.rating} de 5`} /> Sua avaliação</span>
                      : <button className={buttonStyles({ variant: 'primary', size: 'sm' })} type="button" onClick={() => setReviewTarget(item)}><Star aria-hidden="true" /> Avaliar atendimento</button>
                  })()}
                </div>
              ))}
            </details>
          )}
          {history.length === 0 && <p className="mt-4 text-sm text-muted">Seu histórico aparecerá aqui depois do primeiro atendimento concluído ou cancelado.</p>}
        </>
      )}

      {section === 'perfil' && (
        <>
          <PageHeading eyebrow="Seu perfil" title="Preferências e benefícios.">Fidelidade, endereço e lembretes em um só lugar.</PageHeading>
          <div className="grid max-w-[900px] gap-4 md:grid-cols-[1.2fr_1fr]">
            <MyPackages />
            <MembershipPanel mode="customer" services={services} barbers={barbers} />
            <LoyaltyCardPanel />
            <div className="flex items-center gap-3 rounded-2xl bg-chrome p-4 text-chrome-ink [&>svg]:size-5 [&>svg]:text-brand-light [&>div]:grid [&>div]:gap-0.5 [&_span]:text-xs [&_span]:text-chrome-ink/70" data-testid="location-card">
            <MapPin aria-hidden="true" />
            <div>
              <strong>{barbershop?.name || 'Barbearia'}</strong>
              <span>{barbershop?.address || 'Endereço informado no agendamento'}</span>
              {barbershop && <span>Expediente: {formatBusinessHours(barbershop.businessHours)}</span>}
            </div>
          </div>
            <div className="flex items-center gap-3 rounded-2xl bg-chrome p-4 text-chrome-ink [&>svg]:size-5 [&>svg]:text-brand-light [&>div]:grid [&>div]:gap-0.5 [&_span]:text-xs [&_span]:text-chrome-ink/70">
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
    </PageWrap>
    {reviewTarget && (
      <ReviewDialog appointment={reviewTarget} onClose={() => setReviewTarget(null)} onSubmitted={(review) => { setMyReviews((current) => [...current, review]); setReviewTarget(null) }} />
    )}
    {cancelTarget && (
      <ConfirmDialog
        eyebrow="Confirmar cancelamento"
        title="Cancelar este horário?"
        description={cancelDescription(cancelTarget, cancelQuote)}
        cancelLabel="Manter horário"
        confirmLabel={busy ? 'Cancelando…' : 'Sim, cancelar'}
        busy={busy}
        error={cancelError}
        onCancel={() => { setCancelTarget(null); setCancelQuote(null); setCancelError(null) }}
        onConfirm={cancel}
      >
        <label>Motivo (opcional)<textarea maxLength={500} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></label>
      </ConfirmDialog>
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

function cancelDescription(appointment: Appointment, quote: CancellationQuote | null) {
  if (appointment.paymentStatus === 'APPROVED' && quote) {
    return `Você receberá ${formatCurrency(quote.refundedCents / 100)} de volta. A barbearia ficará com ${formatCurrency(quote.feeCents / 100)}${quote.late ? ' porque o cancelamento está dentro da janela configurada.' : '.'}`
  }
  if (appointment.paymentStatus === 'PENDING') {
    return 'A reserva será liberada e nada será cobrado.'
  }
  return 'Tem certeza de que deseja cancelar este horário?'
}

function EmptyAppointments() {
  return (
    <EmptyState>
      <CalendarDays aria-hidden="true" />
      <strong>Nenhum horário marcado</strong>
      <p>Seu próximo agendamento aparecerá aqui.</p>
    </EmptyState>
  )
}
