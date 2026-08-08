import type { AppointmentAvailability } from '../types'

interface AppointmentSlotsProps {
  availability: AppointmentAvailability | null
  error: string | null
  loading: boolean
  selected: string
  browserTimezone: string
  onSelect: (scheduledAt: string) => void
}

export function AppointmentSlots({ availability, error, loading, selected, browserTimezone, onSelect }: AppointmentSlotsProps) {
  const periods = groupSlotsByPeriod(availability?.slots || [])
  if (loading) return <p className="availability-status" role="status">Carregando horários disponíveis…</p>
  if (error) return <p className="availability-status" role="status">{error}</p>
  if (availability && (!availability.open || availability.slots.length === 0)) {
    return <p className="availability-status" role="status">{availability.reason || 'Não há horários livres nesta data'}</p>
  }
  if (!availability?.open || availability.slots.length === 0) return null

  return (
    <div className="availability-block">
      <div className="availability-heading">
        <strong>Horários disponíveis</strong>
        {availability.timezone !== browserTimezone && <small>horários no fuso da barbearia · {availability.timezone}</small>}
      </div>
      <div className="slot-periods" aria-label="Horários disponíveis">
        {periods.map((period) => period.slots.length > 0 && (
          <section className="slot-period" aria-labelledby={`slot-period-${period.key}`} key={period.key}>
            <h4 id={`slot-period-${period.key}`}>{period.label}</h4>
            <div className="slot-grid">
              {period.slots.map((slot) => (
                <button
                  aria-label={`Selecionar horário ${slot.label}`}
                  aria-pressed={selected === slot.scheduledAt}
                  className={`slot-button ${selected === slot.scheduledAt ? 'selected' : ''}`}
                  key={slot.scheduledAt}
                  onClick={() => onSelect(slot.scheduledAt)}
                  type="button"
                >
                  {slot.label}
                  {slot.barbers && <small>{slot.barbers.map((barber) => barber.name).join(' ou ')}</small>}
                </button>
              ))}
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
