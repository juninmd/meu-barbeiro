import { CalendarDays, Check, Clock3, MapPin, Scissors, Sparkles, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { formatCurrency, formatDate, toLocalDateTime } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { Appointment, Barber, NewAppointment, Service } from '../../types'
import { StatusBadge } from '../../components/StatusBadge'

interface ClientDashboardProps {
  appointments: Appointment[]
  barbers: Barber[]
  services: Service[]
  onRefresh: () => Promise<void>
}

export function ClientDashboard({ appointments, barbers, services, onRefresh }: ClientDashboardProps) {
  const [form, setForm] = useState<NewAppointment>({ barberId: '', serviceId: '', scheduledAt: '' })
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const upcoming = appointments
    .filter((item) => item.status !== 'CANCELLED' && item.status !== 'DONE' && new Date(item.scheduledAt) >= new Date())
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const history = appointments.filter((item) => !upcoming.includes(item))
  const selectedService = services.find((item) => item.id === form.serviceId)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await repository.createAppointment(form)
      setForm({ barberId: '', serviceId: '', scheduledAt: '' })
      setMessage('Pedido enviado. O barbeiro já recebeu seu horário.')
      await onRefresh()
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível agendar'))
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (id: string) => {
    setBusy(true)
    try {
      await repository.updateAppointment(id, 'CANCELLED')
      await onRefresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main id="top" className="page-wrap">
      <section className="hero client-hero">
        <div>
          <p className="eyebrow"><Sparkles aria-hidden="true" /> Seu próximo visual</p>
          <h1>Reserve sua cadeira.</h1>
          <p>Escolha o serviço, o profissional e o melhor momento. Simples assim.</p>
        </div>
        <div className="hero-stamp" aria-label="Atendimento de terça a sábado">
          <span>TER — SÁB</span><strong>09—20H</strong><small>com hora marcada</small>
        </div>
      </section>

      <div className="client-grid">
        <section className="panel booking-panel" aria-labelledby="booking-title">
          <div className="section-heading">
            <div><p className="eyebrow">Novo agendamento</p><h2 id="booking-title">Monte seu horário</h2></div>
            <span className="step-count">3 passos</span>
          </div>
          <form onSubmit={submit} className="booking-form">
            <fieldset>
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

            <fieldset>
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
                <span><strong>Data e horário</strong><small>Duração estimada: {selectedService?.duration ?? '—'} min</small></span>
                <input
                  type="datetime-local"
                  value={form.scheduledAt ? toLocalDateTime(new Date(form.scheduledAt)) : ''}
                  min={toLocalDateTime(new Date(Date.now() + 60 * 60 * 1000))}
                  onChange={(event) => setForm({ ...form, scheduledAt: event.target.value ? new Date(event.target.value).toISOString() : '' })}
                  required
                />
              </label>
            </fieldset>

            {message && <p className="form-message" role="status">{message}</p>}
            <button className="button button-primary button-wide" disabled={busy}>
              {busy ? 'Reservando…' : 'Solicitar agendamento'} <CalendarDays aria-hidden="true" />
            </button>
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
                  <button className="text-button danger" disabled={busy} onClick={() => cancel(appointment.id)}>
                    <X aria-hidden="true" /> Cancelar horário
                  </button>
                </article>
              ))}
            </div>
          </section>

          <div className="location-card">
            <MapPin aria-hidden="true" />
            <div><strong>Barbearia Central</strong><span>Rua das Navalhas, 27 · Centro</span></div>
          </div>

          {history.length > 0 && (
            <details className="history">
              <summary>Ver histórico ({history.length})</summary>
              {history.map((item) => <p key={item.id}>{formatDate(item.scheduledAt)} · {item.service.name}</p>)}
            </details>
          )}
        </aside>
      </div>
    </main>
  )
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
