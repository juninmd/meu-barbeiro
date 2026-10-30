import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { StatusBadge } from '../../components/StatusBadge'
import { errorMessage, repository } from '../../lib/repository'
import type { AppointmentCalendar as CalendarData, AppointmentCalendarDay, Barbershop } from '../../types'
import { Badge } from '../../components/ui/Badge'
import { buttonStyles } from '../../components/ui/Button'
import { cardStyles } from '../../components/ui/Card'
import { cn } from '../../lib/cn'
import { IconButton } from '../../components/ui/IconButton'

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
  const [requestRevision, setRequestRevision] = useState(0)
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
  }, [month, refreshKey, requestRevision])

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
    <section className={cn(cardStyles, 'mb-6')} aria-labelledby="calendar-title">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-2 text-[.72rem] font-extrabold tracking-[.18em] text-brand-deep uppercase"><CalendarDays className="size-4" aria-hidden="true" /> Visão mensal</p>
          <h2 id="calendar-title" className="font-serif text-2xl font-medium tracking-tight">Calendário da agenda</h2>
        </div>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto" role="group" aria-label="Navegação entre meses">
          <IconButton tone="subtle" type="button" onClick={() => setMonth(moveMonth(month, -1))} aria-label="Mostrar mês anterior"><ChevronLeft aria-hidden="true" /></IconButton>
          <strong className="min-w-40 text-center font-serif text-base capitalize" aria-live="polite">{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dateAtNoon(`${month}-01`))}</strong>
          <IconButton tone="subtle" type="button" onClick={() => setMonth(moveMonth(month, 1))} aria-label="Mostrar próximo mês"><ChevronRight aria-hidden="true" /></IconButton>
        </div>
      </div>

      {loading && <p className="rounded-xl bg-surface-2 p-4 text-muted" role="status">Carregando calendário…</p>}
      {error && <div className="flex items-center justify-between gap-3 rounded-xl border border-danger-line bg-danger-soft p-4 text-danger-ink" role="alert"><p className="text-sm">{error}</p><button className={buttonStyles({ variant: 'ghost', size: 'sm' })} type="button" onClick={() => setRequestRevision((revision) => revision + 1)}>Tentar novamente</button></div>}
      {calendar && !loading && (
        <>
          <div className="hidden grid-cols-7 md:grid" aria-hidden="true">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => <span key={day} className="p-2 text-center text-[.65rem] font-extrabold tracking-wider text-muted uppercase">{day}</span>)}</div>
          <div className="hidden grid-cols-7 gap-1.5 md:grid" role="group" aria-label={`Agenda de ${month}`}>
            {Array.from({ length: firstWeekday }, (_, index) => <span className="min-h-32" key={`spacer-${index}`} />)}
            {calendar.days.map((day) => (
              <CalendarDayButton day={day} selected={day.date === selectedDay?.date} today={day.date === today} key={day.date} onClick={() => setSelectedDate(day.date)} onKeyDown={(event) => selectWithKeyboard(event, day)} />
            ))}
          </div>
          <div className="grid gap-1.5 md:hidden">
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
  const absent = day.absences.length > 0
  const absenceLabel = absent ? `, ${day.absences.map((absence) => `ausência: ${absence.reason}`).join(', ')}` : ''
  const label = `${dateFormatter.format(dateAtNoon(day.date))}: ${day.appointments.length} atendimento${day.appointments.length === 1 ? '' : 's'}${day.open ? '' : `, fechado, ${day.reason}`}${absenceLabel}`
  return (
    <button
      id={mobile ? undefined : `calendar-day-${day.date}`}
      className={cn(
        'flex min-w-0 flex-col items-stretch gap-1.5 overflow-hidden rounded-xl border border-line bg-surface p-2.5 text-left text-ink transition hover:border-brand hover:bg-tint focus-visible:outline-3 focus-visible:outline-brand',
        mobile ? 'min-h-20' : 'min-h-32',
        !day.open && 'bg-surface-3 text-muted',
        absent && 'border-dashed border-danger bg-danger-soft',
        today && 'ring-2 ring-brand ring-inset',
        selected && 'border-brand bg-tint shadow-glow',
      )}
      type="button"
      aria-pressed={selected}
      aria-current={today ? 'date' : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <span className="sr-only">{label}</span>
      <span className="flex items-center justify-between gap-1.5" aria-hidden="true">
        <small className="text-[.65rem] text-muted capitalize">{mobile ? weekdayFormatter.format(dateAtNoon(day.date)) : ''}</small>
        <strong className="font-serif text-lg font-medium">{Number(day.date.slice(-2))}</strong>
        <em className="min-w-5 rounded-full bg-[#eecb84] p-0.5 text-center text-[.6rem] font-extrabold text-[#5a3f12] not-italic">{day.appointments.length}</em>
      </span>
      {!day.open && <span className="truncate text-[.65rem] text-muted" aria-hidden="true">{day.reason}</span>}
      {day.absences.slice(0, 1).map((absence) => <span className="truncate text-[.68rem] font-bold text-danger-ink" key={absence.id}>{absence.barberName ? `${absence.barberName}: ` : ''}{absence.reason}</span>)}
      {summary.map((appointment) => <span className="truncate rounded-lg bg-field p-1 text-[.65rem]" key={appointment.id}>{appointment.time} · {appointment.user.name}</span>)}
      {day.appointments.length > 2 && <span className="truncate text-[.65rem] text-muted">+ {day.appointments.length - 2} atendimento(s)</span>}
    </button>
  )
}

function DayDetails({ day, showBarber }: { day: AppointmentCalendarDay; showBarber: boolean }) {
  return (
    <section className="mt-6 border-t border-line pt-5" aria-labelledby="calendar-detail-title">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-[.72rem] font-extrabold tracking-[.18em] text-brand-deep uppercase">Dia selecionado</p>
          <h3 id="calendar-detail-title" className="font-serif text-xl font-medium">{dateFormatter.format(dateAtNoon(day.date))}</h3>
        </div>
        <Badge tone="warning">{day.appointments.length}</Badge>
      </div>
      {!day.open && <p className="mb-3 rounded-xl bg-danger-soft p-3 text-sm font-bold text-danger-ink">Fechado · {day.reason}</p>}
      {day.absences.map((absence) => <p className="mb-3 font-bold text-danger-ink" key={absence.id}>Ausência{absence.barberName ? ` de ${absence.barberName}` : ''}: {absence.reason}</p>)}
      {day.appointments.length === 0 && <p className="text-muted">Nenhum atendimento neste dia.</p>}
      <div className="grid gap-2">
        {day.appointments.map((appointment) => (
          <div className="flex items-start gap-4 rounded-xl border border-line bg-field p-3" key={appointment.id}>
            <time className="w-12 shrink-0 font-serif text-lg">{appointment.time}</time>
            <div className="grid min-w-0 flex-1 gap-0.5 [&_small]:text-xs [&_small]:text-muted [&_span]:text-xs [&_span]:text-muted">
              <strong>{appointment.user.name}</strong>
              <span>{appointment.service.name} · {appointment.service.duration} min</span>
              {showBarber && <span>Barbeiro: {appointment.barber.name}</span>}
              <small>Pagamento: {paymentLabels[appointment.paymentStatus]}</small>
            </div>
            <StatusBadge status={appointment.status} />
          </div>
        ))}
      </div>
    </section>
  )
}
