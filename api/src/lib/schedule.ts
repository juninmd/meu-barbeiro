interface BusinessHourWindow {
  weekday: number
  opensAt: string
  closesAt: string
  enabled: boolean
}

interface ScheduleWindow {
  scheduledAt: Date
  duration: number
  timezone?: string
  businessHours?: BusinessHourWindow[]
  now?: Date
}

const defaultHours: BusinessHourWindow[] = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  opensAt: '09:00',
  closesAt: '20:00',
  enabled: weekday >= 2 && weekday <= 6,
}))

const weekdayNumbers: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

const localParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

const minutes = (value: string): number => {
  const [hour, minute] = value.split(':').map(Number)
  return (hour ?? 0) * 60 + (minute ?? 0)
}

export function validateBusinessHours({
  scheduledAt,
  duration,
  timezone = 'America/Sao_Paulo',
  businessHours = defaultHours,
  now = new Date(),
}: ScheduleWindow): string | null {
  if (scheduledAt.getTime() <= now.getTime()) return 'Horário deve estar no futuro'

  const parts = localParts(scheduledAt, timezone)
  const weekday = weekdayNumbers[parts.weekday ?? '']
  const configured = businessHours.find((item) => item.weekday === weekday)
  if (!configured?.enabled) return 'A barbearia não atende neste dia'

  const startMinutes = Number(parts.hour) * 60 + Number(parts.minute)
  if (startMinutes < minutes(configured.opensAt) || startMinutes + duration > minutes(configured.closesAt)) {
    return `Escolha um horário entre ${configured.opensAt} e ${configured.closesAt}`
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
