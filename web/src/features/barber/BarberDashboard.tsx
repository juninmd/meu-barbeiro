import { CalendarCheck, Check, Clock3, Plus, Scissors, Trash2, TrendingUp, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ProgressRing, SwipeAction } from '../../components/ui/SwipeAction'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/Dialog'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { StatusBadge } from '../../components/StatusBadge'
import { CustomerProfileCard } from '../../components/CustomerProfileCard'
import { WalkInQueuePanel } from '../../components/WalkInQueuePanel'
import { MembershipPanel } from '../../components/MembershipPanel'
import { Badge } from '../../components/ui/Badge'
import { BookingLinkCard } from './BookingLinkCard'
import { PackagesPanel } from './PackagesPanel'
import { ReviewsPanel } from './ReviewsPanel'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { Appointment, AppointmentStatus, Barber, Barbershop, NewService, Product, Service, User } from '../../types'
import { AppointmentCalendar } from './AppointmentCalendar'
import { BarberAvailability } from './BarberAvailability'
import { BarbershopSettings } from './BarbershopSettings'
import { DailyClosing } from './DailyClosing'
import { CancellationReportPanel } from './CancellationReportPanel'
import { ProductsPanel } from './ProductsPanel'
import { NotificationSettings } from './NotificationSettings'
import { WalkInForm } from './WalkInForm'
import { TeamPanel } from './TeamPanel'
import { SubscriptionPanel } from './SubscriptionPanel'
import { OnboardingChecklist } from './OnboardingChecklist'
import { InsightsPanel } from './InsightsPanel'
import { buttonStyles, Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { FormRow, InsetForm } from '../../components/ui/FormParts'
import { cardStyles } from '../../components/ui/Card'
import { cn } from '../../lib/cn'
import { CountBadge, EmptyState } from '../../components/ui/EmptyState'
import { PageHeading, PageWrap } from '../../components/ui/Page'
import { Notice, SectionHeading } from '../../components/ui/Notice'
import { IconButton } from '../../components/ui/IconButton'

interface BarberDashboardProps {
  appointments: Appointment[]
  barbers: Barber[]
  barbershop: Barbershop | null
  currentUser: User
  products: Product[]
  services: Service[]
  onRefresh: () => Promise<void>
}

const isToday = (value: string) => new Date(value).toDateString() === new Date().toDateString()

export function BarberDashboard({ appointments, barbers, barbershop, currentUser, products, services, onRefresh }: BarberDashboardProps) {
  const { section } = useParams()
  const [serviceForm, setServiceForm] = useState<NewService>({ name: '', duration: 30, price: 0 })
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [noShowTarget, setNoShowTarget] = useState<Appointment | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [calendarRevision, setCalendarRevision] = useState(0)
  const [queueRevision, setQueueRevision] = useState(0)
  const [profileCustomerId, setProfileCustomerId] = useState<string | null>(null)
  const [walkInOpen, setWalkInOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const active = appointments
    .filter((item) => item.status !== 'CANCELLED')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const today = active.filter((item) => isToday(item.scheduledAt))
  const upcoming = active.filter((item) => !isToday(item.scheduledAt) && new Date(item.scheduledAt) > new Date())
  const previous = active.filter((item) => !isToday(item.scheduledAt) && new Date(item.scheduledAt) <= new Date())
  const pending = active.filter((item) => item.status === 'PENDING')
  const revenue = appointments
    .filter((item) => isToday(item.scheduledAt) && item.status === 'DONE')
    .reduce((sum, item) => sum + item.service.price, 0)
  const canManageBarbershop = barbershop?.membershipRole === 'OWNER' || barbershop?.membershipRole === 'ADMIN'
  const remainingToday = today.filter((item) => new Date(item.scheduledAt) >= new Date() && item.status !== 'DONE')
  const nextToday = remainingToday[0]
  const nextAppointment = upcoming[0]
  const expectedToday = today.reduce((sum, item) => sum + item.service.price, 0)
  const doneToday = today.filter((item) => item.status === 'DONE').length

  // Atalho "Novo encaixe" da paleta de comandos chega como ?acao=encaixe.
  useEffect(() => {
    if (searchParams.get('acao') !== 'encaixe') return
    setSearchParams({}, { replace: true })
    setWalkInOpen(true)
  }, [searchParams, setSearchParams])

  const changeStatus = async (id: string, status: AppointmentStatus, success?: string) => {
    setBusy(true)
    setMessage(null)
    try {
      await repository.updateAppointment(id, status)
      if (success) toast.success(success)
      await onRefresh()
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível atualizar'))
    } finally {
      setBusy(false)
    }
  }

  const createService = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await repository.createService(serviceForm)
      setServiceForm({ name: '', duration: 30, price: 0 })
      setMessage('Serviço adicionado ao catálogo.')
      await onRefresh()
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível criar o serviço'))
    } finally {
      setBusy(false)
    }
  }

  const deleteService = async () => {
    if (!serviceToDelete) return
    setBusy(true)
    setDeleteError(null)
    try {
      await repository.deleteService(serviceToDelete.id)
      setServiceToDelete(null)
      await onRefresh()
    } catch (error) {
      setDeleteError(errorMessage(error, 'Não foi possível excluir'))
    } finally {
      setBusy(false)
    }
  }

  const confirmNoShow = async () => {
    if (!noShowTarget) return
    setBusy(true)
    setMessage(null)
    try {
      const updated = await repository.updateAppointment(noShowTarget.id, 'NO_SHOW')
      setNoShowTarget(null)
      setMessage(updated.depositRetained ? 'Falta registrada. O sinal pago foi retido e não será devolvido.' : 'Falta registrada.')
      await onRefresh()
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível registrar a falta'))
    } finally {
      setBusy(false)
    }
  }

  const confirmCancellation = async () => {
    if (!cancelTarget) return
    setBusy(true)
    setCancelError(null)
    try {
      await repository.updateAppointment(cancelTarget.id, 'CANCELLED', cancelReason)
      setCancelTarget(null)
      setCancelReason('')
      setMessage('Horário cancelado. Se havia sinal pago, o estorno integral foi solicitado.')
      await onRefresh()
    } catch (error) {
      setCancelError(errorMessage(error, 'Não foi possível cancelar'))
    } finally {
      setBusy(false)
    }
  }

  const refreshAfterWalkIn = async () => {
    setQueueRevision((current) => current + 1)
    setMessage('Entrada registrada. A espera será recalculada automaticamente.')
  }

  const refreshAfterQueueCall = async () => {
    await onRefresh()
    setCalendarRevision((current) => current + 1)
  }

  const timelineGroups = [
    { title: 'Hoje', appointments: today, empty: 'Não há atendimento hoje.' },
    { title: 'Próximos', appointments: upcoming },
    { title: 'Anteriores', appointments: previous },
  ]

  const allowedSections = canManageBarbershop
    ? ['hoje', 'agenda', 'clientes', 'produtos', 'financeiro', 'equipe', 'assinatura', 'ajustes']
    : ['hoje', 'agenda', 'clientes', 'produtos']

  if (!section || !allowedSections.includes(section)) return <Navigate replace to="/barbeiro/hoje" />

  const appointmentItem = (appointment: Appointment, compact = false) => (
    <article className={cn('grid', compact ? 'grid-cols-1 gap-0.5 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-4' : 'min-h-36 grid-cols-[48px_1px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[60px_1px_minmax(0,1fr)] sm:gap-4')} key={appointment.id}>
      <time className={cn('flex flex-col items-end', compact && 'max-sm:flex-row max-sm:items-baseline max-sm:gap-2')}>
        <strong className="font-mono text-lg font-semibold">{timeOf(appointment.scheduledAt)}</strong>
        <small className="font-mono text-[.62rem] text-muted uppercase">{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(appointment.scheduledAt))}</small>
      </time>
      {!compact && <div className="relative h-full bg-line before:absolute before:top-1.5 before:-left-1 before:size-2.5 before:rounded-full before:bg-brand before:ring-4 before:ring-brand/20 before:animate-[live_2.4s_ease-in-out_infinite]" aria-hidden="true" />}
      <div className={cn('min-w-0 [&_p]:mb-1.5 [&_p]:flex [&_p]:flex-wrap [&_p]:items-center [&_p]:gap-1.5 [&_p]:text-xs [&_p]:text-muted', !compact && 'pb-7')}>
        <div className="flex items-center justify-between gap-2"><StatusBadge status={appointment.status} /><span className="font-mono text-xs text-muted">{formatCurrency(appointment.service.price)}</span></div>
        <h3 className={cn('font-serif text-xl font-medium', compact ? 'mt-2 mb-1' : 'mt-3 mb-1.5')}>{appointment.user.name}</h3>
        <p><Scissors aria-hidden="true" /> {appointment.service.name} · {appointment.service.duration} min</p>
        {!compact && <p className="reminder-note">{reminderStatus(appointment)}</p>}
        {(appointment.user.noShowCount ?? 0) > 0 && <p className="mt-1.5 text-[.82rem] font-bold text-muted">Histórico: {appointment.user.noShowCount} falta(s) nesta barbearia</p>}
        {appointment.depositRetained && <p className="mt-1.5 text-[.82rem] font-bold text-muted">Sinal pago retido</p>}
        <div className={cn('flex flex-wrap gap-2.5', compact ? 'mt-2' : 'mt-3')}>
          {!compact && <button className={buttonStyles({ variant: 'ghost', size: 'sm' })} type="button" onClick={() => setProfileCustomerId((current) => current === appointment.userId ? null : appointment.userId)}>{profileCustomerId === appointment.userId ? 'Fechar ficha' : 'Abrir ficha'}</button>}
          {appointment.status === 'PENDING' && <button className={buttonStyles({ variant: 'primary', size: 'sm' })} disabled={busy} onClick={() => changeStatus(appointment.id, 'CONFIRMED')}><Check aria-hidden="true" /> Confirmar</button>}
          {appointment.status === 'CONFIRMED' && <button className={buttonStyles({ variant: 'primary', size: 'sm' })} disabled={busy} onClick={() => changeStatus(appointment.id, 'DONE')}><Check aria-hidden="true" /> Concluir</button>}
          {!compact && appointment.status === 'CONFIRMED' && new Date(appointment.scheduledAt).getTime() < Date.now() && <button className={buttonStyles({ variant: 'danger', size: 'sm' })} disabled={busy} onClick={() => setNoShowTarget(appointment)}><X aria-hidden="true" /> Faltou</button>}
          {!compact && (appointment.status === 'PENDING' || appointment.status === 'CONFIRMED') && <button className={buttonStyles({ variant: 'ghost', size: 'sm' })} disabled={busy} onClick={() => { setCancelTarget(appointment); setCancelReason(''); setCancelError(null) }}><X aria-hidden="true" /> Cancelar</button>}
        </div>
        {!compact && profileCustomerId === appointment.userId && <CustomerProfileCard userId={appointment.userId} />}
      </div>
    </article>
  )

  const customers = [...new Map(appointments.map((appointment) => [appointment.userId, appointment.user])).values()]

  return (
    <>
    <PageWrap id="top" data-section={section}>
      {message && <Notice role="status">{message}</Notice>}

      {section === 'hoje' && (
        <>
          <PageHeading
            eyebrow={<><Scissors aria-hidden="true" /> {new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(new Date())}</>}
            title="A cadeira está pronta."
            aside={(
              <time className="grid shrink-0 justify-items-center rounded-2xl border border-line bg-surface px-3 py-2 text-ink uppercase shadow-sm">
                <strong className="font-serif text-[2.4rem] leading-[.85] font-medium sm:text-[3.2rem]">{new Date().getDate()}</strong>
                <span className="font-mono text-[.66rem] font-semibold tracking-[.12em] text-pole-ink">{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date())}</span>
              </time>
            )}
          />
          {canManageBarbershop && <OnboardingChecklist />}
          <div className="grid items-start gap-5 lg:grid-cols-2">
          <section className="relative grid animate-fade-up gap-4 overflow-hidden rounded-[1.6rem] bg-ink p-5 text-paper shadow-card sm:p-6" aria-labelledby="next-client-title">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 flex items-center gap-2 font-mono text-[.66rem] font-semibold tracking-[.14em] text-paper/65 uppercase">{nextToday ? <><span className="live-dot" aria-hidden="true" /> {new Date(nextToday.scheduledAt).getTime() <= Date.now() + 15 * 60_000 ? 'Agora' : 'Na sequência'} · {timeOf(nextToday.scheduledAt)}</> : 'Na sequência'}</p>
                <h2 id="next-client-title" className="font-serif text-lg font-medium text-paper/80">{nextToday ? 'Próximo cliente' : 'Agenda livre agora'}</h2>
              </div>
              <CountBadge className="bg-paper/10 text-paper">{remainingToday.length}</CountBadge>
            </div>
            {nextToday ? (
              <>
                <div className="grid gap-1">
                  <strong className="font-serif text-[2rem] leading-none font-medium">{nextToday.user.name}</strong>
                  <span className="flex flex-wrap items-center gap-x-2 text-sm text-paper/70">{nextToday.service.name} · {nextToday.service.duration} min · <span className="font-mono">{formatCurrency(nextToday.service.price)}</span>{nextToday.status === 'PENDING' && <Badge tone="warning">Aguardando</Badge>}</span>
                  {(nextToday.user.noShowCount ?? 0) > 0 && <span className="text-xs font-semibold text-paper/70">Histórico: {nextToday.user.noShowCount} falta(s) nesta barbearia</span>}
                </div>
                {(nextToday.status === 'PENDING' || nextToday.status === 'CONFIRMED') && (
                  <SwipeAction
                    label={nextToday.status === 'PENDING' ? 'Deslize para confirmar' : 'Deslize para concluir'}
                    actionLabel={`${nextToday.status === 'PENDING' ? 'Confirmar' : 'Concluir'} atendimento de ${nextToday.user.name}`}
                    disabled={busy}
                    onComplete={() => changeStatus(nextToday.id, nextToday.status === 'PENDING' ? 'CONFIRMED' : 'DONE', nextToday.status === 'PENDING' ? `${nextToday.user.name} confirmado.` : `${nextToday.user.name} concluído · +${formatCurrency(nextToday.service.price)}`)}
                  />
                )}
                <button type="button" className="justify-self-start text-sm font-semibold text-paper/75 underline-offset-4 hover:text-paper hover:underline" onClick={() => setProfileCustomerId((current) => current === nextToday.userId ? null : nextToday.userId)}>{profileCustomerId === nextToday.userId ? 'Fechar ficha' : 'Abrir ficha e preferências'}</button>
              </>
            ) : <EmptyState className="border-paper/20 bg-paper/5 text-paper/70 [&_strong]:text-paper [&_svg]:text-paper/70"><CalendarCheck aria-hidden="true" /><strong>Ninguém aguardando hoje</strong><p>{nextAppointment ? `Próximo dia com agenda: ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(nextAppointment.scheduledAt))}.` : 'Novos agendamentos aparecerão aqui.'}</p></EmptyState>}
          </section>
          <WalkInQueuePanel canCall callerBarberId={barbershop?.membershipRole === 'BARBER' ? currentUser.id : undefined} onCalled={refreshAfterQueueCall} refreshKey={queueRevision} />
          </div>
          {nextToday && profileCustomerId === nextToday.userId && <CustomerProfileCard userId={nextToday.userId} />}
          <section className="grid animate-fade-up grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-[1.4rem] border border-line bg-surface p-3.5 shadow-card sm:gap-6 sm:p-5" aria-label="Resumo da agenda">
            <ProgressRing value={expectedToday > 0 ? revenue / expectedToday : 0} size={84}>
              <strong className="font-mono text-base font-semibold">{expectedToday > 0 ? Math.round((revenue / expectedToday) * 100) : 0}%</strong>
            </ProgressRing>
            <div className="grid min-w-0 gap-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-xs text-muted">Entrou hoje</span>
                <span className="font-mono text-[.7rem] text-muted">previsto {formatCurrency(expectedToday)}</span>
              </div>
              <strong className="-mt-2 font-serif text-[1.9rem] leading-none font-medium tabular-nums">{formatCurrency(revenue)}</strong>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                <Metric icon={<Clock3 />} label="Faltam" value={String(remainingToday.length)} note="clientes hoje" />
                <Metric icon={<CalendarCheck />} label="Aguardando" value={String(pending.length)} note="para confirmar" alert={pending.length > 0} />
                <Metric icon={<TrendingUp />} label="Feitos" value={String(doneToday)} note="concluídos" />
              </div>
            </div>
          </section>
          {today.length > 0 && (
            <section className={cardStyles} aria-labelledby="today-line-title">
              <SectionHeading eyebrow="Linha do tempo" title="Seu dia" id="today-line-title" aside={<CountBadge>{today.length}</CountBadge>} className="mb-4" />
              <ol className="grid gap-2">
                {today.map((appointment) => {
                  const isNow = appointment.id === nextToday?.id
                  return (
                    <li key={appointment.id} className="grid gap-2">
                      {isNow && <span className="flex items-center gap-2 font-mono text-[.64rem] font-semibold tracking-[.12em] text-pole-ink uppercase after:h-0.5 after:flex-1 after:rounded-full after:bg-pole" aria-hidden="true">agora</span>}
                      <div className={cn('grid grid-cols-[3.4rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-line bg-surface-2 px-3.5 py-2.5 transition', appointment.status === 'DONE' && 'opacity-55', isNow && 'border-brand bg-tint')}>
                        <time className="font-mono text-sm font-semibold">{timeOf(appointment.scheduledAt)}</time>
                        <span className="grid min-w-0"><strong className={cn('truncate text-sm', appointment.status === 'DONE' && 'line-through')}>{appointment.user.name}</strong><small className="truncate text-xs text-muted">{appointment.service.name}</small></span>
                        <StatusBadge status={appointment.status} />
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          )}
          {barbershop && (
            <button
              type="button"
              onClick={() => setWalkInOpen(true)}
              className="fixed right-4 bottom-[calc(88px+env(safe-area-inset-bottom))] z-30 flex min-h-14 items-center gap-2 rounded-[18px] bg-brand px-5 font-semibold text-on-brand shadow-glow transition duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] hover:scale-105 hover:-rotate-2 active:scale-95 min-[901px]:right-8 min-[901px]:bottom-8"
            >
              <Plus aria-hidden="true" /> Encaixe
            </button>
          )}
        </>
      )}

      {section === 'agenda' && (
        <>
          <PageHeading eyebrow="Operação" title="Agenda e disponibilidade.">Atendimentos, encaixes, calendário e ausências reunidos.</PageHeading>
          {barbershop && <WalkInForm barbers={barbers} barbershop={barbershop} currentUser={currentUser} services={services} onCreated={refreshAfterWalkIn} />}
          {barbershop && <div id="disponibilidade" className="scroll-mt-28"><BarberAvailability barbers={barbers} barbershop={barbershop} currentUser={currentUser} onChanged={() => setCalendarRevision((current) => current + 1)} /></div>}
          {barbershop && <AppointmentCalendar barbershop={barbershop} refreshKey={`${calendarRevision}:${appointments.map((item) => `${item.id}:${item.status}`).join(',')}`} />}
        <section className={cn(cardStyles, 'agenda-panel')} aria-labelledby="agenda-title">
          <SectionHeading eyebrow="Linha do tempo" title="Agenda de atendimento" id="agenda-title" aside={<CountBadge>{active.length}</CountBadge>} className="mb-5" />
          <div className="grid">
            {timelineGroups.map((group) => (group.appointments.length > 0 || group.empty) && (
              <section className="mt-6 first:mt-0" aria-labelledby={`timeline-${group.title.toLowerCase()}`} key={group.title}>
                <div className="mb-3 flex items-center justify-between gap-4 border-b border-line pb-2.5">
                  <h3 id={`timeline-${group.title.toLowerCase()}`} className="font-serif text-lg font-medium">{group.title}</h3>
                  <Badge tone="warning">{group.appointments.length}</Badge>
                </div>
                {group.appointments.length === 0 && <p className="text-sm text-muted">{group.empty}</p>}
                {group.appointments.map((appointment) => appointmentItem(appointment))}
              </section>
            ))}
          </div>
        </section>
        </>
      )}

      {section === 'clientes' && (
        <>
          <PageHeading eyebrow="Relacionamento" title="Clientes.">Abra a ficha, consulte fidelidade e registre preferências sem procurar na agenda.</PageHeading>
          <section className={cardStyles} aria-labelledby="customers-title">
            <SectionHeading eyebrow="Base atendida" title="Fichas de clientes" id="customers-title" aside={<CountBadge>{customers.length}</CountBadge>} className="mb-5" />
            {customers.length === 0 && <EmptyState><UserRound aria-hidden="true" /><strong>Nenhum cliente ainda</strong><p>As fichas aparecem depois do primeiro agendamento.</p></EmptyState>}
            <div className="grid gap-3">
              {customers.map((customer) => (
                <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-line bg-surface-2 p-4 max-sm:grid-cols-1" key={customer.id}>
                  <div className="grid gap-0.5"><strong>{customer.name}</strong><span className="text-xs text-muted">{appointments.filter((appointment) => appointment.userId === customer.id).length} atendimento(s)</span></div>
                  <button className={buttonStyles({ variant: 'ghost', size: 'sm' })} type="button" onClick={() => setProfileCustomerId((current) => current === customer.id ? null : customer.id)}>{profileCustomerId === customer.id ? 'Fechar ficha' : 'Abrir ficha'}</button>
                  {profileCustomerId === customer.id && <CustomerProfileCard userId={customer.id} />}
                </article>
              ))}
            </div>
          </section>
          <ReviewsPanel />
        </>
      )}

      {section === 'produtos' && (
        <><PageHeading eyebrow="Estoque e balcão" title="Produtos.">Venda, entrada e catálogo em uma área própria.</PageHeading><ProductsPanel canManage={canManageBarbershop} products={products} onRefresh={onRefresh} /></>
      )}

      {section === 'financeiro' && barbershop && (
        <><PageHeading eyebrow="Resultados" title="Financeiro.">Feche o período e acompanhe o que entrou.</PageHeading><InsightsPanel appointments={appointments} /><div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"><div id="fechamento" className="scroll-mt-28"><DailyClosing barbershop={barbershop} /></div><CancellationReportPanel /></div></>
      )}

      {section === 'equipe' && barbershop && (
        <>
          <PageHeading eyebrow="Pessoas" title="Equipe.">Convites, papéis e limites do plano em um só lugar.</PageHeading>
          <TeamPanel barbershop={barbershop} currentUserId={currentUser.id} />
        </>
      )}

      {section === 'assinatura' && barbershop && (
        <>
          <PageHeading eyebrow="Conta e cobrança" title="Assinatura.">Plano, teste grátis e forma de pagamento do Meu Barbeiro.</PageHeading>
          <SubscriptionPanel barbershop={barbershop} onRefresh={onRefresh} />
        </>
      )}

      {section === 'ajustes' && (
        <>
          <PageHeading eyebrow="Administração" title="Ajustes.">Serviços, marca, horários, sinal, lembretes e fidelidade.</PageHeading>
          <section id="servicos" className={cn(cardStyles, 'scroll-mt-28')} aria-labelledby="services-title">
          <SectionHeading eyebrow="Seu menu" title="Serviços" id="services-title" className="mb-5" />
          <div className="grid">
            {services.length === 0 && <p className="text-sm text-muted">Nenhum serviço cadastrado. Adicione o primeiro serviço abaixo.</p>}
            {services.map((service) => (
              <article className="flex items-center justify-between gap-2 border-b border-line py-3.5" key={service.id}>
                <div className="grid gap-0.5"><strong className="text-[.88rem]">{service.name}</strong><span className="text-xs text-muted">{service.duration} min · {formatCurrency(service.price)}</span></div>
                {canManageBarbershop && (
                  <IconButton tone="subtle" disabled={busy} onClick={() => {
                    setMessage(null)
                    setDeleteError(null)
                    setServiceToDelete(service)
                  }} aria-label={`Excluir ${service.name}`}>
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                )}
              </article>
            ))}
          </div>
          {canManageBarbershop && (
            <InsetForm title="Novo serviço" icon={<Plus aria-hidden="true" />} onSubmit={createService}>
              <Field label="Nome"><Input value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} required minLength={3} /></Field>
              <FormRow>
                <Field label="Duração (min)"><Input type="number" min="10" max="240" step="5" value={serviceForm.duration} onChange={(event) => setServiceForm({ ...serviceForm, duration: Number(event.target.value) })} required /></Field>
                <Field label="Preço (R$)"><Input type="number" min="1" step="0.01" value={serviceForm.price || ''} onChange={(event) => setServiceForm({ ...serviceForm, price: Number(event.target.value) })} required /></Field>
              </FormRow>
              <Button type="submit" variant="dark" block loading={busy}><Plus aria-hidden="true" /> Adicionar ao menu</Button>
            </InsetForm>
          )}
          </section>
          {canManageBarbershop && <MembershipPanel mode="management" services={services} barbers={barbers} />}
          {barbershop && canManageBarbershop && <BookingLinkCard barbershop={barbershop} />}
          {canManageBarbershop && <PackagesPanel services={services} />}
          <NotificationSettings />
          {barbershop && <BarbershopSettings barbershop={barbershop} onRefresh={onRefresh} />}
        </>
      )}
    </PageWrap>
    {barbershop && (
      <Dialog open={walkInOpen} onOpenChange={setWalkInOpen}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="sr-only">Novo encaixe</DialogTitle>
          <DialogDescription className="sr-only">Registre quem chegou sem horário e veja se cabe agora.</DialogDescription>
          {walkInOpen && <WalkInForm bare defaultOpen barbers={barbers} barbershop={barbershop} currentUser={currentUser} services={services} onCreated={refreshAfterWalkIn} onClose={() => setWalkInOpen(false)} />}
        </DialogContent>
      </Dialog>
    )}
    {serviceToDelete && (
      <ConfirmDialog
        eyebrow="Confirmar exclusão"
        title={`Excluir ${serviceToDelete.name}?`}
        description="O serviço será removido do catálogo e não poderá ser escolhido em novos agendamentos."
        cancelLabel="Manter serviço"
        confirmLabel={busy ? 'Excluindo…' : 'Sim, excluir'}
        busy={busy}
        error={deleteError}
        onCancel={() => {
          setDeleteError(null)
          setServiceToDelete(null)
        }}
        onConfirm={deleteService}
      />
    )}
    {noShowTarget && (
      <ConfirmDialog
        eyebrow="Registrar falta"
        title={`${noShowTarget.user.name} faltou?`}
        description={noShowTarget.paymentStatus === 'APPROVED'
          ? 'O atendimento será encerrado como falta. O sinal pago será retido e não será devolvido.'
          : 'O atendimento será encerrado como falta e não poderá mais ser alterado.'}
        cancelLabel="Voltar"
        confirmLabel={busy ? 'Registrando…' : 'Sim, faltou'}
        busy={busy}
        onCancel={() => setNoShowTarget(null)}
        onConfirm={confirmNoShow}
      />
    )}
    {cancelTarget && (
      <ConfirmDialog
        eyebrow="Cancelar pela barbearia"
        title={`Cancelar o horário de ${cancelTarget.user.name}?`}
        description="A barbearia devolverá integralmente qualquer sinal pago. Informe o motivo para manter o histórico confiável."
        cancelLabel="Manter horário"
        confirmLabel={busy ? 'Cancelando…' : 'Cancelar horário'}
        busy={busy}
        confirmDisabled={!cancelReason.trim()}
        error={cancelError}
        onCancel={() => { setCancelTarget(null); setCancelReason(''); setCancelError(null) }}
        onConfirm={confirmCancellation}
      >
        <label>Motivo<textarea required maxLength={500} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></label>
      </ConfirmDialog>
    )}
    </>
  )
}

interface MetricProps {
  icon: React.ReactNode
  label: string
  value: string
  note: string
  alert?: boolean
}

function Metric({ icon, label, value, note, alert = false }: MetricProps) {
  return (
    <article className={cn('grid min-w-0 gap-0.5 rounded-xl px-2.5 py-2 tabular-nums transition sm:px-3.5 sm:py-2.5', alert ? 'bg-warn-soft text-warn' : 'bg-surface-2')}>
      <span className="flex items-center gap-1 truncate text-[.66rem] font-semibold [&_svg]:size-3 sm:text-xs" aria-hidden="false"><span aria-hidden="true" className="contents">{icon}</span>{label}</span>
      <strong className="font-mono text-lg leading-tight font-semibold sm:text-xl">{value}</strong>
      <small className="truncate text-[.6rem] text-muted sm:text-[.66rem]">{note}</small>
    </article>
  )
}

const timeOf = (value: string) => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))

function reminderStatus(appointment: Appointment) {
  const delivered = appointment.reminders?.filter((reminder) => reminder.deliveredOk) ?? []
  const failed = appointment.reminders?.some((reminder) => !reminder.deliveredOk)
  const delivery = delivered.length > 0
    ? `Lembrete Telegram enviado (${delivered.map((reminder) => reminder.kind).join(' e ')})`
    : failed ? 'Falha ao enviar lembrete Telegram' : 'Lembrete Telegram ainda não enviado'
  return `${delivery} · ${appointment.clientConfirmed ? 'confirmado pelo cliente' : 'sem confirmação do cliente'}`
}
