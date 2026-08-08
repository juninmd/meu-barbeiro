import { CalendarCheck, Check, Clock3, Plus, Scissors, Trash2, TrendingUp, X } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { StatusBadge } from '../../components/StatusBadge'
import { CustomerProfileCard } from '../../components/CustomerProfileCard'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { Appointment, AppointmentStatus, Barber, Barbershop, NewService, Product, Service, User } from '../../types'
import { AppointmentCalendar } from './AppointmentCalendar'
import { BarberAvailability } from './BarberAvailability'
import { BarbershopSettings } from './BarbershopSettings'
import { DailyClosing } from './DailyClosing'
import { ProductsPanel } from './ProductsPanel'
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
  const [serviceForm, setServiceForm] = useState<NewService>({ name: '', duration: 30, price: 0 })
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [noShowTarget, setNoShowTarget] = useState<Appointment | null>(null)
  const [calendarRevision, setCalendarRevision] = useState(0)
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
  const nextAppointment = upcoming[0]
  const nextDayCount = nextAppointment
    ? upcoming.filter((item) => new Date(item.scheduledAt).toDateString() === new Date(nextAppointment.scheduledAt).toDateString()).length
    : 0

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

  const refreshAfterWalkIn = async () => {
    await onRefresh()
    setCalendarRevision((current) => current + 1)
    setMessage('Atendimento lançado e confirmado. O pagamento será feito no balcão.')
  }

  const timelineGroups = [
    { title: 'Hoje', appointments: today, empty: 'Não há atendimento hoje.' },
    { title: 'Próximos', appointments: upcoming },
    { title: 'Anteriores', appointments: previous },
  ]

  return (
    <>
    <main id="top" className="page-wrap">
      <section className="hero barber-hero">
        <div>
          <p className="eyebrow"><Scissors aria-hidden="true" /> Central do profissional</p>
          <h1>A cadeira está pronta.</h1>
          <p>Confirme pedidos, acompanhe o dia e mantenha seu catálogo em ordem.</p>
        </div>
        <div className="hero-date"><span>{new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(new Date())}</span><strong>{new Date().getDate()}</strong></div>
      </section>

      <section className="metric-grid" aria-label="Resumo da agenda">
        <Metric icon={<CalendarCheck />} label="Hoje" value={String(today.length)} note="horários na cadeira" />
        <Metric icon={<Clock3 />} label="Aguardando" value={String(pending.length)} note="pedidos para confirmar" alert={pending.length > 0} />
        <Metric icon={<TrendingUp />} label="Caixa hoje" value={formatCurrency(revenue)} note="somente serviços concluídos" />
      </section>
      {today.length === 0 && (
        <p className="empty-day-note" role="status">
          Sem atendimentos hoje{nextAppointment
            ? ` · próximo: ${new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(nextAppointment.scheduledAt))} (${nextDayCount} ${nextDayCount === 1 ? 'horário' : 'horários'})`
            : ''}
        </p>
      )}

      {message && <p className="form-message global-message" role="status">{message}</p>}

      {barbershop && <DailyClosing barbershop={barbershop} />}

      {barbershop && <WalkInForm barbers={barbers} barbershop={barbershop} currentUser={currentUser} services={services} onCreated={refreshAfterWalkIn} />}

      {barbershop && <BarberAvailability barbers={barbers} barbershop={barbershop} currentUser={currentUser} onChanged={() => setCalendarRevision((current) => current + 1)} />}

      {barbershop && <AppointmentCalendar barbershop={barbershop} refreshKey={`${calendarRevision}:${appointments.map((item) => `${item.id}:${item.status}`).join(',')}`} />}

      <div className="barber-grid">
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
                {group.appointments.map((appointment) => (
                  <article className="timeline-item" key={appointment.id}>
                    <time>
                      <strong>{new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(appointment.scheduledAt))}</strong>
                      <small>{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(appointment.scheduledAt))}</small>
                    </time>
                    <div className="timeline-line" />
                    <div className="timeline-content">
                      <div className="appointment-top"><StatusBadge status={appointment.status} /><span>{formatCurrency(appointment.service.price)}</span></div>
                      <h3>{appointment.user.name}</h3>
                      <p><Scissors aria-hidden="true" /> {appointment.service.name} · {appointment.service.duration} min</p>
                      <p className="reminder-note">{reminderStatus(appointment)}</p>
                      {(appointment.user.noShowCount ?? 0) > 0 && <p className="no-show-note">Histórico: {appointment.user.noShowCount} falta(s) nesta barbearia</p>}
                      {appointment.depositRetained && <p className="no-show-note">Sinal pago retido</p>}
                      <div className="action-row">
                        <button className="button button-small button-ghost" type="button" onClick={() => setProfileCustomerId((current) => current === appointment.userId ? null : appointment.userId)}>
                          {profileCustomerId === appointment.userId ? 'Fechar ficha' : 'Abrir ficha'}
                        </button>
                        {appointment.status === 'PENDING' && (
                          <button className="button button-small button-primary" disabled={busy} onClick={() => changeStatus(appointment.id, 'CONFIRMED')}>
                            <Check aria-hidden="true" /> Confirmar
                          </button>
                        )}
                        {appointment.status === 'CONFIRMED' && (
                          <button className="button button-small button-primary" disabled={busy} onClick={() => changeStatus(appointment.id, 'DONE')}>
                            <Check aria-hidden="true" /> Concluir
                          </button>
                        )}
                        {appointment.status === 'CONFIRMED' && new Date(appointment.scheduledAt).getTime() < Date.now() && (
                          <button className="button button-small button-danger" disabled={busy} onClick={() => setNoShowTarget(appointment)}>
                            <X aria-hidden="true" /> Faltou
                          </button>
                        )}
                        {(appointment.status === 'PENDING' || appointment.status === 'CONFIRMED') && (
                          <button className="button button-small button-ghost" disabled={busy} onClick={() => changeStatus(appointment.id, 'CANCELLED')}>
                            <X aria-hidden="true" /> Cancelar
                          </button>
                        )}
                      </div>
                      {profileCustomerId === appointment.userId && <CustomerProfileCard userId={appointment.userId} />}
                    </div>
                  </article>
                ))}
              </section>
            ))}
          </div>
        </section>

        <div className="catalog-stack">
          <section className="panel services-panel" aria-labelledby="services-title">
          <div className="section-heading compact">
            <div><p className="eyebrow">Seu menu</p><h2 id="services-title">Serviços</h2></div>
          </div>
          <div className="service-list">
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
          <ProductsPanel canManage={canManageBarbershop} products={products} onRefresh={onRefresh} />
        </div>
      </div>
      {barbershop && <BarbershopSettings barbershop={barbershop} onRefresh={onRefresh} />}
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
