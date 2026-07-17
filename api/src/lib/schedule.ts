interface ScheduleWindow {
  scheduledAt: Date
  duration: number
}

const localParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function validateBusinessHours({ scheduledAt, duration }: ScheduleWindow): string | null {
  if (scheduledAt.getTime() <= Date.now()) return 'Horário deve estar no futuro'

  const parts = localParts(scheduledAt)
  if (parts.weekday === 'Sun' || parts.weekday === 'Mon') return 'Atendemos de terça a sábado'

  const startMinutes = Number(parts.hour) * 60 + Number(parts.minute)
  if (startMinutes < 9 * 60 || startMinutes + duration > 20 * 60) {
    return 'Escolha um horário entre 09:00 e 20:00'
  }
  return null
}

export function schedulesOverlap(first: ScheduleWindow, second: ScheduleWindow): boolean {
  const firstStart = first.scheduledAt.getTime()
  const firstEnd = firstStart + first.duration * 60_000
  const secondStart = second.scheduledAt.getTime()
  const secondEnd = secondStart + second.duration * 60_000
  return firstStart < secondEnd && secondStart < firstEnd
}
