import { CalendarCheck, Check, Clock3, Plus, Scissors, Trash2, TrendingUp, X } from 'lucide-react'
import { useState } from 'react'
import { StatusBadge } from '../../components/StatusBadge'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { Appointment, AppointmentStatus, Barbershop, NewService, Service } from '../../types'
import { BarbershopSettings } from './BarbershopSettings'

interface BarberDashboardProps {
  appointments: Appointment[]
  barbershop: Barbershop | null
  services: Service[]
  onRefresh: () => Promise<void>
}

const isToday = (value: string) => new Date(value).toDateString() === new Date().toDateString()

export function BarberDashboard({ appointments, barbershop, services, onRefresh }: BarberDashboardProps) {
  const [serviceForm, setServiceForm] = useState<NewService>({ name: '', duration: 30, price: 0 })
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const active = appointments
    .filter((item) => item.status !== 'CANCELLED')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const today = active.filter((item) => isToday(item.scheduledAt))
  const pending = active.filter((item) => item.status === 'PENDING')
  const revenue = appointments
    .filter((item) => item.status === 'DONE' || item.status === 'CONFIRMED')
    .reduce((sum, item) => sum + item.service.price, 0)

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

  const deleteService = async (id: string) => {
    setBusy(true)
    setMessage(null)
    try {
      await repository.deleteService(id)
      await onRefresh()
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível excluir'))
    } finally {
      setBusy(false)
    }
  }

  return (
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
        <Metric icon={<TrendingUp />} label="Previsto" value={formatCurrency(revenue)} note="agenda confirmada" />
      </section>

      {message && <p className="form-message global-message" role="status">{message}</p>}

      <div className="barber-grid">
        <section className="panel agenda-panel" aria-labelledby="agenda-title">
          <div className="section-heading">
            <div><p className="eyebrow">Linha do tempo</p><h2 id="agenda-title">Agenda de atendimento</h2></div>
            <span className="count-badge">{active.length}</span>
          </div>
          <div className="timeline">
            {active.length === 0 && <p className="empty-copy">Nenhum atendimento na agenda.</p>}
            {active.map((appointment) => (
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
                  <div className="action-row">
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
                    {(appointment.status === 'PENDING' || appointment.status === 'CONFIRMED') && (
                      <button className="button button-small button-ghost" disabled={busy} onClick={() => changeStatus(appointment.id, 'CANCELLED')}>
                        <X aria-hidden="true" /> Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel services-panel" aria-labelledby="services-title">
          <div className="section-heading compact">
            <div><p className="eyebrow">Seu menu</p><h2 id="services-title">Serviços</h2></div>
          </div>
          <div className="service-list">
            {services.map((service) => (
              <article className="service-row" key={service.id}>
                <div><strong>{service.name}</strong><span>{service.duration} min · {formatCurrency(service.price)}</span></div>
                <button className="icon-button subtle" disabled={busy} onClick={() => deleteService(service.id)} aria-label={`Excluir ${service.name}`}>
                  <Trash2 aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
          <form className="service-form" onSubmit={createService}>
            <h3><Plus aria-hidden="true" /> Novo serviço</h3>
            <label>Nome<input value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} required minLength={3} /></label>
            <div className="form-row">
              <label>Duração (min)<input type="number" min="10" max="240" step="5" value={serviceForm.duration} onChange={(event) => setServiceForm({ ...serviceForm, duration: Number(event.target.value) })} required /></label>
              <label>Preço (R$)<input type="number" min="1" step="0.01" value={serviceForm.price || ''} onChange={(event) => setServiceForm({ ...serviceForm, price: Number(event.target.value) })} required /></label>
            </div>
            <button className="button button-dark button-wide" disabled={busy}><Plus aria-hidden="true" /> Adicionar ao menu</button>
          </form>
        </section>
      </div>
      {barbershop && <BarbershopSettings barbershop={barbershop} onRefresh={onRefresh} />}
    </main>
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
