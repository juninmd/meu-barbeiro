import type { AppointmentAvailability } from '../types'
import { Button } from './ui/Button'
import { Notice } from './ui/Notice'
import { cn } from '../lib/cn'

interface AppointmentSlotsProps {
  availability: AppointmentAvailability | null
  error: string | null
  loading: boolean
  selected: string
  browserTimezone: string
  onSelect: (scheduledAt: string) => void
  onRetry?: () => void
}

export function AppointmentSlots({ availability, error, loading, selected, browserTimezone, onSelect, onRetry }: AppointmentSlotsProps) {
  const periods = groupSlotsByPeriod(availability?.slots || [])
  if (loading) return <p className="text-xs text-muted" role="status">Carregando horários disponíveis…</p>
  if (error) return <Notice tone="danger" role="alert" className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span>{onRetry && <Button variant="ghost" size="sm" onClick={onRetry}>Tentar novamente</Button>}</Notice>
  if (availability && (!availability.open || availability.slots.length === 0)) {
    return <p className="text-xs text-muted" role="status">{availability.reason || 'Não há horários livres nesta data'}</p>
  }
  if (!availability?.open || availability.slots.length === 0) return null

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <strong className="text-sm">Horários disponíveis</strong>
        {availability.timezone !== browserTimezone && <small className="text-xs text-muted">horários no fuso da barbearia · {availability.timezone}</small>}
      </div>
      <div className="grid gap-4" aria-label="Horários disponíveis">
        {periods.map((period) => period.slots.length > 0 && (
          <section aria-labelledby={`slot-period-${period.key}`} key={period.key}>
            <h4 id={`slot-period-${period.key}`} className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">{period.label}</h4>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(5rem,1fr))]">
              {period.slots.map((slot) => {
                const active = selected === slot.scheduledAt
                return (
                  <button
                    aria-label={`Selecionar horário ${slot.label}`}
                    aria-pressed={active}
                    className={cn(
                      'grid min-h-11 content-center gap-0.5 rounded-xl border px-2 py-2 text-sm font-extrabold tabular-nums transition duration-200 hover:border-brand-deep/70 hover:bg-tint focus-visible:ring-4 focus-visible:ring-brand/35 focus-visible:outline-none',
                      active ? 'border-brand bg-tint text-tint-ink ring-2 ring-brand' : 'border-line bg-surface-2 text-ink',
                    )}
                    key={slot.scheduledAt}
                    onClick={() => onSelect(slot.scheduledAt)}
                    type="button"
                  >
                    {slot.label}
                    {slot.barbers && <small className="text-[.6rem] font-semibold">{slot.barbers.map((barber) => barber.name).join(' ou ')}</small>}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function groupSlotsByPeriod(slots: AppointmentAvailability['slots']) {
  const periods = [
    { key: 'morning', label: 'Manhã', start: 0, end: 12 },
    { key: 'afternoon', label: 'Tarde', start: 12, end: 18 },
    { key: 'night', label: 'Noite', start: 18, end: 24 },
  ]
  return periods.map((period) => ({
    ...period,
    slots: slots.filter((slot) => {
      const hour = Number(slot.label.slice(0, 2))
      return hour >= period.start && hour < period.end
    }),
  }))
}
