import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { StatusBadge } from '../../components/StatusBadge'
import { errorMessage, repository } from '../../lib/repository'
import type { AppointmentCalendar as CalendarData, AppointmentCalendarDay, Barbershop } from '../../types'

interface AppointmentCalendarProps {
  barbershop: Barbershop
  refreshKey: string
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
const paymentLabels: Record<string, string> = {
  NOT_REQUIRED: 'Não necessário', PENDING: 'Pendente', APPROVED: 'Aprovado', REJECTED: 'Recusado', REFUNDED: 'Estornado',
}

const dateAtNoon = (date: string) => new Date(`${date}T12:00:00.000Z`)

const todayInTimezone = (timezone: string) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

const monthRange = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year ?? 0, monthNumber ?? 0, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` }
}

const moveMonth = (month: string, amount: number) => {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year ?? 0, (monthNumber ?? 1) - 1 + amount, 1)).toISOString().slice(0, 7)
}

export function AppointmentCalendar({ barbershop, refreshKey }: AppointmentCalendarProps) {
  const today = todayInTimezone(barbershop.timezone)
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(today)
  const [calendar, setCalendar] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const canViewAll = barbershop.membershipRole === 'OWNER' || barbershop.membershipRole === 'ADMIN'

  useEffect(() => {
    const range = monthRange(month)
    setLoading(true)
    setError(null)
    repository.appointmentCalendar(range.from, range.to)
      .then((data) => {
        setCalendar(data)
        setSelectedDate((current) => current.startsWith(month) ? current : range.from)
      })
      .catch((caught) => setError(errorMessage(caught, 'Não foi possível carregar o calendário')))
      .finally(() => setLoading(false))
  }, [month, refreshKey])

  const selectWithKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>, day: AppointmentCalendarDay) => {
    const index = calendar?.days.findIndex((item) => item.date === day.date) ?? -1
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    let nextIndex = index + (offsets[event.key] ?? 0)
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = (calendar?.days.length ?? 1) - 1
    if (!Object.hasOwn(offsets, event.key) && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const next = calendar?.days[nextIndex]
    if (!next) return
    setSelectedDate(next.date)
    requestAnimationFrame(() => document.getElementById(`calendar-day-${next.date}`)?.focus())
  }

  const selectedDay = calendar?.days.find((day) => day.date === selectedDate) ?? calendar?.days[0]
  const firstWeekday = calendar ? dateAtNoon(calendar.from).getUTCDay() : 0

  return (
    <section className="panel calendar-panel" aria-labelledby="calendar-title">
      <div className="calendar-heading">
        <div><p className="eyebrow"><CalendarDays aria-hidden="true" /> Visão mensal</p><h2 id="calendar-title">Calendário da agenda</h2></div>
        <div className="calendar-navigation" aria-label="Navegação entre meses">
          <button className="icon-button subtle" type="button" onClick={() => setMonth(moveMonth(month, -1))} aria-label="Mostrar mês anterior"><ChevronLeft aria-hidden="true" /></button>
          <strong aria-live="polite">{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dateAtNoon(`${month}-01`))}</strong>
          <button className="icon-button subtle" type="button" onClick={() => setMonth(moveMonth(month, 1))} aria-label="Mostrar próximo mês"><ChevronRight aria-hidden="true" /></button>
        </div>
      </div>

      {loading && <p className="calendar-feedback" role="status">Carregando calendário…</p>}
      {error && <p className="calendar-feedback" role="alert">{error}</p>}
      {calendar && !loading && (
        <>
          <div className="calendar-weekdays" aria-hidden="true">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid" role="grid" aria-label={`Agenda de ${month}`}>
            {Array.from({ length: firstWeekday }, (_, index) => <span className="calendar-spacer" key={`spacer-${index}`} />)}
            {calendar.days.map((day) => (
              <CalendarDayButton day={day} selected={day.date === selectedDay?.date} today={day.date === today} key={day.date} onClick={() => setSelectedDate(day.date)} onKeyDown={(event) => selectWithKeyboard(event, day)} />
            ))}
          </div>
          <div className="calendar-mobile-list">
            {calendar.days.map((day) => (
              <CalendarDayButton day={day} selected={day.date === selectedDay?.date} today={day.date === today} key={day.date} onClick={() => setSelectedDate(day.date)} onKeyDown={(event) => selectWithKeyboard(event, day)} mobile />
            ))}
          </div>
          {selectedDay && <DayDetails day={selectedDay} showBarber={canViewAll} />}
        </>
      )}
    </section>
  )
}

interface CalendarDayButtonProps {
  day: AppointmentCalendarDay
  selected: boolean
  today: boolean
  mobile?: boolean
  onClick: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void
}

function CalendarDayButton({ day, selected, today, mobile = false, onClick, onKeyDown }: CalendarDayButtonProps) {
  const summary = day.appointments.slice(0, 2)
  const absenceLabel = day.absences.length > 0 ? `, ${day.absences.map((absence) => `ausência: ${absence.reason}`).join(', ')}` : ''
  const label = `${dateFormatter.format(dateAtNoon(day.date))}: ${day.appointments.length} atendimento${day.appointments.length === 1 ? '' : 's'}${day.open ? '' : `, fechado, ${day.reason}`}${absenceLabel}`
  return (
    <button
      id={mobile ? undefined : `calendar-day-${day.date}`}
      className={`calendar-day ${mobile ? 'calendar-day-mobile' : ''} ${selected ? 'selected' : ''} ${today ? 'today' : ''} ${day.open ? '' : 'closed'} ${day.absences.length > 0 ? 'has-absence' : ''}`}
      type="button"
      role={mobile ? undefined : 'gridcell'}
      aria-label={label}
      aria-pressed={selected}
      aria-current={today ? 'date' : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <span className="calendar-day-number"><small>{mobile ? weekdayFormatter.format(dateAtNoon(day.date)) : ''}</small><strong>{Number(day.date.slice(-2))}</strong><em>{day.appointments.length}</em></span>
      {!day.open && <span className="calendar-closed-reason">{day.reason}</span>}
      {day.absences.slice(0, 1).map((absence) => <span className="calendar-absence" key={absence.id}>{absence.barberName ? `${absence.barberName}: ` : ''}{absence.reason}</span>)}
      {summary.map((appointment) => <span className="calendar-summary" key={appointment.id}>{appointment.time} · {appointment.user.name}</span>)}
      {day.appointments.length > 2 && <span className="calendar-more">+ {day.appointments.length - 2} atendimento(s)</span>}
    </button>
  )
}

function DayDetails({ day, showBarber }: { day: AppointmentCalendarDay; showBarber: boolean }) {
  return (
    <section className="calendar-details" aria-labelledby="calendar-detail-title">
      <div className="calendar-detail-heading">
        <div><p className="eyebrow">Dia selecionado</p><h3 id="calendar-detail-title">{dateFormatter.format(dateAtNoon(day.date))}</h3></div>
        <span className="count-badge">{day.appointments.length}</span>
      </div>
      {!day.open && <p className="calendar-closed-detail">Fechado · {day.reason}</p>}
      {day.absences.map((absence) => <p className="calendar-absence-detail" key={absence.id}>Ausência{absence.barberName ? ` de ${absence.barberName}` : ''}: {absence.reason}</p>)}
      {day.appointments.length === 0 && <p className="empty-copy">Nenhum atendimento neste dia.</p>}
      <div className="calendar-appointment-list">
        {day.appointments.map((appointment) => (
          <div className="calendar-appointment" key={appointment.id}>
            <time>{appointment.time}</time>
            <div><strong>{appointment.user.name}</strong><span>{appointment.service.name} · {appointment.service.duration} min</span>{showBarber && <span>Barbeiro: {appointment.barber.name}</span>}<small>Pagamento: {paymentLabels[appointment.paymentStatus]}</small>{(appointment.user.noShowCount ?? 0) > 0 && <small>{appointment.user.noShowCount} falta(s) nesta barbearia</small>}{appointment.depositRetained && <small>Sinal pago retido</small>}</div>
            <StatusBadge status={appointment.status} />
          </div>
        ))}
      </div>
    </section>
  )
}
