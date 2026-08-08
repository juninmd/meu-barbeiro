export const staffNotificationTypes = [
  'NEW_APPOINTMENT',
  'CANCELLATION',
  'RESCHEDULE',
  'NO_SHOW',
  'DAILY_SUMMARY',
] as const

export type StaffNotificationType = typeof staffNotificationTypes[number]
export type StaffMembershipRole = 'OWNER' | 'ADMIN' | 'BARBER'

export interface StaffMembership {
  userId: string
  role: StaffMembershipRole
  notificationTypes: string[]
  telegramId: string | null
}

interface StaffEvent {
  type: Exclude<StaffNotificationType, 'DAILY_SUMMARY'>
  barberIds: string[]
  actorId: string
}

interface PendingStaffNotification {
  id: string
  recipientId: string
  barbershopId: string
  telegramId: string
  message: string
}

export interface StaffNotificationGroup {
  ids: string[]
  telegramId: string
  message: string
}

interface DailyAppointment {
  scheduledAt: Date
  duration: number
  customerName: string
}

interface DailySummaryInput {
  barbershopName: string
  recipientName: string
  timezone: string
  consolidated: boolean
  appointments: DailyAppointment[]
}

export function selectStaffRecipients(
  event: StaffEvent,
  memberships: StaffMembership[],
): StaffMembership[] {
  const barberIds = new Set(event.barberIds)
  return memberships.filter((membership) => {
    if (membership.userId === event.actorId
      || !membership.telegramId
      || !membership.notificationTypes.includes(event.type)) return false
    if (barberIds.has(membership.userId)) return true
    return event.type === 'CANCELLATION' && ['OWNER', 'ADMIN'].includes(membership.role)
  })
}

export function groupStaffNotifications(
  notifications: PendingStaffNotification[],
): StaffNotificationGroup[] {
  const groups = new Map<string, PendingStaffNotification[]>()
  for (const notification of notifications) {
    const key = `${notification.barbershopId}:${notification.recipientId}`
    groups.set(key, [...(groups.get(key) ?? []), notification])
  }
  return [...groups.values()].map((items) => ({
    ids: items.map((item) => item.id),
    telegramId: items[0]!.telegramId,
    message: items.length === 1
      ? items[0]!.message
      : [`🔔 ${items.length} atualizações na agenda`, '', ...items.map((item) => `• ${item.message}`)].join('\n'),
  }))
}

export function dailySummaryDateIfDue(now: Date, timezone: string, summaryTime: string): string | null {
  const parts = localParts(now, timezone)
  const localTime = `${parts.hour}:${parts.minute}`
  return localTime >= summaryTime ? `${parts.year}-${parts.month}-${parts.day}` : null
}

export function buildDailySummary(input: DailySummaryInput): string {
  const appointments = [...input.appointments].sort((left, right) => (
    left.scheduledAt.getTime() - right.scheduledAt.getTime()
  ))
  const heading = input.consolidated ? 'Resumo consolidado do dia' : 'Seu resumo do dia'
  if (appointments.length === 0) {
    return [`Bom dia, ${input.recipientName}! 💈`, '', `${heading} — ${input.barbershopName}`, 'Nenhum cliente agendado hoje.'].join('\n')
  }

  const gaps: string[] = []
  let occupiedUntil = appointments[0]!.scheduledAt.getTime() + appointments[0]!.duration * 60_000
  for (const appointment of appointments.slice(1)) {
    const startsAt = appointment.scheduledAt.getTime()
    if (startsAt > occupiedUntil) {
      gaps.push(`${formatTime(new Date(occupiedUntil), input.timezone)}–${formatTime(appointment.scheduledAt, input.timezone)}`)
    }
    occupiedUntil = Math.max(occupiedUntil, startsAt + appointment.duration * 60_000)
  }

  return [
    `Bom dia, ${input.recipientName}! 💈`,
    '',
    `${heading} — ${input.barbershopName}`,
    `${appointments.length} ${appointments.length === 1 ? 'cliente' : 'clientes'}`,
    `Primeiro horário: ${formatTime(appointments[0]!.scheduledAt, input.timezone)}`,
    `Último horário: ${formatTime(appointments.at(-1)!.scheduledAt, input.timezone)}`,
    `Buracos: ${gaps.length ? gaps.join(', ') : 'nenhum'}`,
  ].join('\n')
}

function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

function localParts(date: Date, timezone: string): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).map((part) => [part.type, part.value]))
}
