interface BusinessHourWindow {
  weekday: number
  opensAt: string
  closesAt: string
  enabled: boolean
}

interface ScheduleWindow {
  id?: string
  scheduledAt: Date
  duration: number
  timezone?: string
  businessHours?: BusinessHourWindow[]
  now?: Date
}

interface AppointmentScheduleOptions extends ScheduleWindow {
  scheduled?: ScheduleWindow[]
  excludeAppointmentId?: string
}

interface AppointmentScheduleError {
  code: 'conflict' | 'hours'
  message: string
}

interface AvailabilityOptions {
  date: string
  duration: number
  timezone?: string
  businessHours?: BusinessHourWindow[]
  scheduled?: ScheduleWindow[]
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
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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

const dateAtLocalTime = (date: string, time: string, timezone: string): Date => {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const target = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0)
  let timestamp = target

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const local = localParts(new Date(timestamp), timezone)
    const represented = Date.UTC(
      Number(local.year),
      Number(local.month) - 1,
      Number(local.day),
      Number(local.hour),
      Number(local.minute),
    )
    timestamp += target - represented
  }

  return new Date(timestamp)
}

export function availabilitySlots({
  date,
  duration,
  timezone = 'America/Sao_Paulo',
  businessHours = defaultHours,
  scheduled = [],
  now = new Date(),
}: AvailabilityOptions) {
  const weekday = weekdayNumbers[localParts(dateAtLocalTime(date, '12:00', timezone), timezone).weekday ?? '']
  const configured = businessHours.find((item) => item.weekday === weekday)
  if (!configured?.enabled) {
    return { open: false, reason: 'A barbearia não atende neste dia', slots: [] }
  }

  const slots = []
  for (let start = minutes(configured.opensAt); start < minutes(configured.closesAt); start += 15) {
    const hour = String(Math.floor(start / 60)).padStart(2, '0')
    const minute = String(start % 60).padStart(2, '0')
    const label = `${hour}:${minute}`
    const scheduledAt = dateAtLocalTime(date, label, timezone)
    if (validateBusinessHours({ scheduledAt, duration, timezone, businessHours, now })) continue
    if (scheduled.some((item) => schedulesOverlap(item, { scheduledAt, duration }))) continue
    slots.push({ scheduledAt, label })
  }

  return {
    open: true,
    reason: slots.length === 0 ? 'Não há horários livres nesta data' : null,
    slots,
  }
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

export function validateAppointmentSchedule(options: AppointmentScheduleOptions): AppointmentScheduleError | null {
  const scheduleError = validateBusinessHours(options)
  if (scheduleError) return { code: 'hours', message: scheduleError }

  const conflict = options.scheduled?.some((item) => (
    (!options.excludeAppointmentId || item.id !== options.excludeAppointmentId) && schedulesOverlap(item, options)
  ))
  return conflict ? { code: 'conflict', message: 'Este horário acabou de ser reservado' } : null
}

export function validateRescheduleStatus(status: string): string | null {
  return ['PENDING', 'CONFIRMED'].includes(status)
    ? null
    : 'Este agendamento não pode ser remarcado'
}
