import { CalendarCheck, Check, Clock3, Plus, Scissors, Trash2, TrendingUp, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
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

  const changeStatus = async (id: string, status: AppointmentStatus) => {
    setBusy(true)
    setMessage(null)
    try {
      await repository.updateAppointment(id, status)
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
    ? ['hoje', 'agenda', 'clientes', 'produtos', 'financeiro', 'ajustes']
    : ['hoje', 'agenda', 'clientes', 'produtos']

  if (!section || !allowedSections.includes(section)) return <Navigate replace to="/barbeiro/hoje" />

  const appointmentItem = (appointment: Appointment, compact = false) => (
    <article className={cn('grid', compact ? 'grid-cols-1 gap-0.5 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-4' : 'min-h-36 grid-cols-[48px_1px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[60px_1px_minmax(0,1fr)] sm:gap-4')} key={appointment.id}>
      <time className={cn('flex flex-col items-end', compact && 'max-sm:flex-row max-sm:items-baseline max-sm:gap-2')}>
        <strong className="font-serif text-xl font-medium">{new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(appointment.scheduledAt))}</strong>
        <small className="text-[.65rem] text-muted uppercase">{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(appointment.scheduledAt))}</small>
      </time>
      {!compact && <div className="relative h-full bg-line before:absolute before:top-1.5 before:-left-1 before:size-2.5 before:rounded-full before:bg-brand before:ring-4 before:ring-brand/20" aria-hidden="true" />}
      <div className={cn('min-w-0 [&_p]:mb-1.5 [&_p]:flex [&_p]:flex-wrap [&_p]:items-center [&_p]:gap-1.5 [&_p]:text-xs [&_p]:text-muted', !compact && 'pb-7')}>
        <div className="flex items-center justify-between gap-2"><StatusBadge status={appointment.status} /><span className="text-xs text-muted">{formatCurrency(appointment.service.price)}</span></div>
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
              <time className="grid shrink-0 justify-items-center text-brand-deep uppercase">
                <strong className="font-serif text-[2.7rem] leading-[.8] font-medium sm:text-[3.5rem]">{new Date().getDate()}</strong>
                <span className="text-[.7rem] font-black tracking-[.12em]">{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date())}</span>
              </time>
            )}
          />
          <section className="grid grid-cols-3 gap-1.5 sm:gap-4" aria-label="Resumo da agenda">
            <Metric icon={<Clock3 />} label="Faltam" value={String(remainingToday.length)} note="clientes hoje" />
            <Metric icon={<CalendarCheck />} label="Aguardando" value={String(pending.length)} note="para confirmar" alert={pending.length > 0} />
            <Metric icon={<TrendingUp />} label="Entrou" value={formatCurrency(revenue)} note="concluído hoje" />
          </section>
          <div className="grid items-start gap-5 lg:grid-cols-2">
          <section className={cardStyles} aria-labelledby="next-client-title">
            <SectionHeading eyebrow="Na sequência" title={nextToday ? 'Próximo cliente' : 'Agenda livre agora'} id="next-client-title" aside={<CountBadge>{remainingToday.length}</CountBadge>} className="mb-5" />
            {nextToday ? appointmentItem(nextToday, true) : <EmptyState><CalendarCheck aria-hidden="true" /><strong>Ninguém aguardando hoje</strong><p>{nextAppointment ? `Próximo dia com agenda: ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(nextAppointment.scheduledAt))}.` : 'Use Agenda para lançar um encaixe.'}</p></EmptyState>}
          </section>
          <WalkInQueuePanel canCall callerBarberId={barbershop?.membershipRole === 'BARBER' ? currentUser.id : undefined} onCalled={refreshAfterQueueCall} refreshKey={queueRevision} />
          </div>
        </>
      )}

      {section === 'agenda' && (
        <>
          <PageHeading eyebrow="Operação" title="Agenda e disponibilidade.">Atendimentos, encaixes, calendário e ausências reunidos.</PageHeading>
          {barbershop && <WalkInForm barbers={barbers} barbershop={barbershop} currentUser={currentUser} services={services} onCreated={refreshAfterWalkIn} />}
          {barbershop && <BarberAvailability barbers={barbers} barbershop={barbershop} currentUser={currentUser} onChanged={() => setCalendarRevision((current) => current + 1)} />}
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
        <><PageHeading eyebrow="Resultados" title="Financeiro.">Feche o período e acompanhe o que entrou.</PageHeading><DailyClosing barbershop={barbershop} /><CancellationReportPanel /></>
      )}

      {section === 'ajustes' && (
        <>
          <PageHeading eyebrow="Administração" title="Ajustes.">Serviços, marca, horários, sinal, lembretes e fidelidade.</PageHeading>
          <section className={cardStyles} aria-labelledby="services-title">
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
    <article className={cn('grid min-w-0 justify-items-start gap-1.5 rounded-2xl border p-2.5 tabular-nums shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:flex sm:items-center sm:gap-4 sm:p-5', alert ? 'border-brand bg-tint' : 'border-line bg-surface')}>
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-[#f7e3b6] to-[#efd08c] text-brand-deep sm:size-11" aria-hidden="true">{icon}</div>
      <div className="grid min-w-0">
        <span className="text-[.58rem] font-extrabold tracking-wide text-muted uppercase sm:text-[.68rem]">{label}</span>
        <strong className="my-0.5 font-serif text-lg font-medium tracking-tight sm:text-[1.65rem]">{value}</strong>
        <small className="truncate text-[.58rem] text-muted sm:text-[.68rem]">{note}</small>
      </div>
    </article>
  )
}

function reminderStatus(appointment: Appointment) {
  const delivered = appointment.reminders?.filter((reminder) => reminder.deliveredOk) ?? []
  const failed = appointment.reminders?.some((reminder) => !reminder.deliveredOk)
  const delivery = delivered.length > 0
    ? `Lembrete Telegram enviado (${delivered.map((reminder) => reminder.kind).join(' e ')})`
    : failed ? 'Falha ao enviar lembrete Telegram' : 'Lembrete Telegram ainda não enviado'
  return `${delivery} · ${appointment.clientConfirmed ? 'confirmado pelo cliente' : 'sem confirmação do cliente'}`
}
