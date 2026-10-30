import type { BusinessHour } from '../types'

const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Dia da semana (0 = domingo) e "HH:MM" no fuso da barbearia. */
export const localMoment = (date: Date, timezone: string) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((part) => [part.type, part.value]))
  return { weekday: weekdayIndex[parts.weekday ?? 'Sun'] ?? 0, time: `${parts.hour}:${parts.minute}` }
}

export interface OpenStatus {
  open: boolean
  /** Texto curto: "Aberto até 20:00", "Fecha para o almoço, volta às 13:00", "Abre amanhã às 09:00"… */
  label: string
}

export function openStatus(hours: BusinessHour[], timezone: string, now = new Date()): OpenStatus {
  const { weekday, time } = localMoment(now, timezone)
  const today = hours.find((hour) => hour.weekday === weekday)
  if (today?.enabled) {
    if (time >= today.opensAt && time < today.closesAt) {
      if (today.breakStartsAt && today.breakEndsAt && time >= today.breakStartsAt && time < today.breakEndsAt) {
        return { open: false, label: `Pausa para o almoço, volta às ${today.breakEndsAt}` }
      }
      return { open: true, label: `Aberto até ${today.closesAt}` }
    }
    if (time < today.opensAt) return { open: false, label: `Abre hoje às ${today.opensAt}` }
  }
  for (let offset = 1; offset <= 7; offset += 1) {
    const next = hours.find((hour) => hour.weekday === (weekday + offset) % 7 && hour.enabled)
    if (next) return { open: false, label: offset === 1 ? `Fechado agora · abre amanhã às ${next.opensAt}` : `Fechado agora · abre ${weekdayName[next.weekday]} às ${next.opensAt}` }
  }
  return { open: false, label: 'Fechado' }
}

export const weekdayName = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
