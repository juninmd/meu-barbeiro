import { CalendarCheck, Check, Clock3, Plus, Scissors, Trash2, TrendingUp, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { StatusBadge } from '../../components/StatusBadge'
import { CustomerProfileCard } from '../../components/CustomerProfileCard'
import { WalkInQueuePanel } from '../../components/WalkInQueuePanel'
import { MembershipPanel } from '../../components/MembershipPanel'
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
    <article className={`timeline-item ${compact ? 'timeline-item-compact' : ''}`} key={appointment.id}>
      <time>
        <strong>{new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(appointment.scheduledAt))}</strong>
        <small>{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(appointment.scheduledAt))}</small>
      </time>
      {!compact && <div className="timeline-line" />}
      <div className="timeline-content">
        <div className="appointment-top"><StatusBadge status={appointment.status} /><span>{formatCurrency(appointment.service.price)}</span></div>
        <h3>{appointment.user.name}</h3>
        <p><Scissors aria-hidden="true" /> {appointment.service.name} · {appointment.service.duration} min</p>
        {!compact && <p className="reminder-note">{reminderStatus(appointment)}</p>}
        {(appointment.user.noShowCount ?? 0) > 0 && <p className="no-show-note">Histórico: {appointment.user.noShowCount} falta(s) nesta barbearia</p>}
        {appointment.depositRetained && <p className="no-show-note">Sinal pago retido</p>}
        <div className="action-row">
          {!compact && <button className="button button-small button-ghost" type="button" onClick={() => setProfileCustomerId((current) => current === appointment.userId ? null : appointment.userId)}>{profileCustomerId === appointment.userId ? 'Fechar ficha' : 'Abrir ficha'}</button>}
          {appointment.status === 'PENDING' && <button className="button button-small button-primary" disabled={busy} onClick={() => changeStatus(appointment.id, 'CONFIRMED')}><Check aria-hidden="true" /> Confirmar</button>}
          {appointment.status === 'CONFIRMED' && <button className="button button-small button-primary" disabled={busy} onClick={() => changeStatus(appointment.id, 'DONE')}><Check aria-hidden="true" /> Concluir</button>}
          {!compact && appointment.status === 'CONFIRMED' && new Date(appointment.scheduledAt).getTime() < Date.now() && <button className="button button-small button-danger" disabled={busy} onClick={() => setNoShowTarget(appointment)}><X aria-hidden="true" /> Faltou</button>}
          {!compact && (appointment.status === 'PENDING' || appointment.status === 'CONFIRMED') && <button className="button button-small button-ghost" disabled={busy} onClick={() => { setCancelTarget(appointment); setCancelReason(''); setCancelError(null) }}><X aria-hidden="true" /> Cancelar</button>}
        </div>
        {!compact && profileCustomerId === appointment.userId && <CustomerProfileCard userId={appointment.userId} />}
      </div>
    </article>
  )

  const customers = [...new Map(appointments.map((appointment) => [appointment.userId, appointment.user])).values()]

  return (
    <>
    <main id="top" className="page-wrap section-page" data-section={section}>
      {message && <p className="form-message global-message" role="status">{message}</p>}

      {section === 'hoje' && (
        <>
          <header className="page-heading today-heading">
            <div><p className="eyebrow"><Scissors aria-hidden="true" /> {new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(new Date())}</p><h1>A cadeira está pronta.</h1></div>
            <time><strong>{new Date().getDate()}</strong><span>{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date())}</span></time>
          </header>
          <section className="metric-grid today-metrics" aria-label="Resumo da agenda">
            <Metric icon={<Clock3 />} label="Faltam" value={String(remainingToday.length)} note="clientes hoje" />
            <Metric icon={<CalendarCheck />} label="Aguardando" value={String(pending.length)} note="para confirmar" alert={pending.length > 0} />
            <Metric icon={<TrendingUp />} label="Entrou" value={formatCurrency(revenue)} note="concluído hoje" />
          </section>
          <section className="panel next-client-panel" aria-labelledby="next-client-title">
            <div className="section-heading compact"><div><p className="eyebrow">Na sequência</p><h2 id="next-client-title">{nextToday ? 'Próximo cliente' : 'Agenda livre agora'}</h2></div><span className="count-badge">{remainingToday.length}</span></div>
            {nextToday ? appointmentItem(nextToday, true) : <div className="empty-state"><CalendarCheck aria-hidden="true" /><strong>Ninguém aguardando hoje</strong><p>{nextAppointment ? `Próximo dia com agenda: ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(nextAppointment.scheduledAt))}.` : 'Use Agenda para lançar um encaixe.'}</p></div>}
          </section>
          <WalkInQueuePanel canCall callerBarberId={barbershop?.membershipRole === 'BARBER' ? currentUser.id : undefined} onCalled={refreshAfterQueueCall} refreshKey={queueRevision} />
        </>
      )}

      {section === 'agenda' && (
        <>
          <header className="page-heading"><p className="eyebrow">Operação</p><h1>Agenda e disponibilidade.</h1><p>Atendimentos, encaixes, calendário e ausências reunidos.</p></header>
          {barbershop && <WalkInForm barbers={barbers} barbershop={barbershop} currentUser={currentUser} services={services} onCreated={refreshAfterWalkIn} />}
          {barbershop && <BarberAvailability barbers={barbers} barbershop={barbershop} currentUser={currentUser} onChanged={() => setCalendarRevision((current) => current + 1)} />}
          {barbershop && <AppointmentCalendar barbershop={barbershop} refreshKey={`${calendarRevision}:${appointments.map((item) => `${item.id}:${item.status}`).join(',')}`} />}
        <section className="panel agenda-panel" aria-labelledby="agenda-title">
          <div className="section-heading">
            <div><p className="eyebrow">Linha do tempo</p><h2 id="agenda-title">Agenda de atendimento</h2></div>
            <span className="count-badge">{active.length}</span>
          </div>
          <div className="timeline">
            {timelineGroups.map((group) => (group.appointments.length > 0 || group.empty) && (
              <section className="timeline-group" aria-labelledby={`timeline-${group.title.toLowerCase()}`} key={group.title}>
                <div className="timeline-group-heading">
                  <h3 id={`timeline-${group.title.toLowerCase()}`}>{group.title}</h3>
                  <span className="count-badge">{group.appointments.length}</span>
                </div>
                {group.appointments.length === 0 && <p className="empty-copy">{group.empty}</p>}
                {group.appointments.map((appointment) => appointmentItem(appointment))}
              </section>
            ))}
          </div>
        </section>
        </>
      )}

      {section === 'clientes' && (
        <>
          <header className="page-heading"><p className="eyebrow">Relacionamento</p><h1>Clientes.</h1><p>Abra a ficha, consulte fidelidade e registre preferências sem procurar na agenda.</p></header>
          <section className="panel customers-panel" aria-labelledby="customers-title">
            <div className="section-heading compact"><div><p className="eyebrow">Base atendida</p><h2 id="customers-title">Fichas de clientes</h2></div><span className="count-badge">{customers.length}</span></div>
            {customers.length === 0 && <div className="empty-state"><UserRound aria-hidden="true" /><strong>Nenhum cliente ainda</strong><p>As fichas aparecem depois do primeiro agendamento.</p></div>}
            <div className="customer-card-list">
              {customers.map((customer) => (
                <article className="customer-card" key={customer.id}>
                  <div><strong>{customer.name}</strong><span>{appointments.filter((appointment) => appointment.userId === customer.id).length} atendimento(s)</span></div>
                  <button className="button button-small button-ghost" type="button" onClick={() => setProfileCustomerId((current) => current === customer.id ? null : customer.id)}>{profileCustomerId === customer.id ? 'Fechar ficha' : 'Abrir ficha'}</button>
                  {profileCustomerId === customer.id && <CustomerProfileCard userId={customer.id} />}
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {section === 'produtos' && (
        <><header className="page-heading"><p className="eyebrow">Estoque e balcão</p><h1>Produtos.</h1><p>Venda, entrada e catálogo em uma área própria.</p></header><ProductsPanel canManage={canManageBarbershop} products={products} onRefresh={onRefresh} /></>
      )}

      {section === 'financeiro' && barbershop && (
        <><header className="page-heading"><p className="eyebrow">Resultados</p><h1>Financeiro.</h1><p>Feche o período e acompanhe o que entrou.</p></header><DailyClosing barbershop={barbershop} /><CancellationReportPanel /></>
      )}

      {section === 'ajustes' && (
        <>
          <header className="page-heading"><p className="eyebrow">Administração</p><h1>Ajustes.</h1><p>Serviços, marca, horários, sinal, lembretes e fidelidade.</p></header>
          <section className="panel services-panel" aria-labelledby="services-title">
          <div className="section-heading compact">
            <div><p className="eyebrow">Seu menu</p><h2 id="services-title">Serviços</h2></div>
          </div>
          <div className="service-list">
            {services.length === 0 && <p className="empty-copy">Nenhum serviço cadastrado. Adicione o primeiro serviço abaixo.</p>}
            {services.map((service) => (
              <article className="service-row" key={service.id}>
                <div><strong>{service.name}</strong><span>{service.duration} min · {formatCurrency(service.price)}</span></div>
                {canManageBarbershop && (
                  <button className="icon-button subtle" disabled={busy} onClick={() => {
                    setMessage(null)
                    setDeleteError(null)
                    setServiceToDelete(service)
                  }} aria-label={`Excluir ${service.name}`}>
                    <Trash2 aria-hidden="true" />
                  </button>
                )}
              </article>
            ))}
          </div>
          {canManageBarbershop && (
            <form className="service-form" onSubmit={createService}>
              <h3><Plus aria-hidden="true" /> Novo serviço</h3>
              <label>Nome<input value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} required minLength={3} /></label>
              <div className="form-row">
                <label>Duração (min)<input type="number" min="10" max="240" step="5" value={serviceForm.duration} onChange={(event) => setServiceForm({ ...serviceForm, duration: Number(event.target.value) })} required /></label>
                <label>Preço (R$)<input type="number" min="1" step="0.01" value={serviceForm.price || ''} onChange={(event) => setServiceForm({ ...serviceForm, price: Number(event.target.value) })} required /></label>
              </div>
              <button className="button button-dark button-wide" disabled={busy}><Plus aria-hidden="true" /> Adicionar ao menu</button>
            </form>
          )}
          </section>
          {canManageBarbershop && <MembershipPanel mode="management" services={services} barbers={barbers} />}
          <NotificationSettings />
          {canManageBarbershop && <MembershipPanel mode="management" services={services} barbers={barbers} />}
          {barbershop && <BarbershopSettings barbershop={barbershop} onRefresh={onRefresh} />}
        </>
      )}
    </main>
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
    <article className={`metric ${alert ? 'metric-alert' : ''}`}>
      <div className="metric-icon" aria-hidden="true">{icon}</div>
      <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
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
