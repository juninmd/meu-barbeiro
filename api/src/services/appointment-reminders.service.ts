import { prisma } from '../lib/prisma.js'
import { dateAtLocalTime } from '../lib/schedule.js'
import {
  buildDailySummary,
  dailySummaryDateIfDue,
  groupStaffNotifications,
  selectStaffRecipients,
  type StaffMembership,
  type StaffNotificationType,
} from '../lib/staff-notifications.js'
import { processRecurringBookings } from './recurring-bookings.service.js'

type ReminderKind = '24h' | '2h'

interface ReminderOptions {
  reply_markup?: {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>
  }
}

export type ReminderSend = (
  telegramId: string,
  message: string,
  options?: ReminderOptions,
) => Promise<unknown>

interface ReminderAppointment {
  id: string
  scheduledAt: Date
  status: string
  user: { id: string; name: string; telegramId: string | null }
  barber: { name: string }
  service: { name: string }
  barbershop: {
    id: string
    name: string
    address: string | null
    timezone: string
    remindersEnabled: boolean
    reminderHoursBefore: number[]
  }
  reminders: Array<{ kind: string; channel: string }>
}

export interface ReminderDatabase {
  appointment: {
    findMany(input: unknown): Promise<ReminderAppointment[]>
    findFirst(input: unknown): Promise<{ id: string; status: string } | null>
    updateMany(input: unknown): Promise<{ count: number }>
  }
  appointmentReminder: {
    create(input: unknown): Promise<{ id: string }>
    update(input: unknown): Promise<unknown>
  }
}

interface StaffNotificationMembership extends StaffMembership {
  dailySummaryTime: string
  user: { id: string; name: string; telegramId: string | null }
  barbershop: { id: string; name: string; timezone: string }
}

interface PendingStaffReminder {
  id: string
  recipientId: string
  barbershopId: string
  message: string | null
  recipient: { telegramId: string | null }
}

export interface StaffNotificationDatabase {
  membership: {
    findMany(input: unknown): Promise<StaffNotificationMembership[]>
  }
  appointment: {
    findMany(input: unknown): Promise<Array<{
      scheduledAt: Date
      service: { duration: number }
      user: { name: string }
    }>>
  }
  appointmentReminder: {
    create(input: unknown): Promise<{ id: string }>
    findMany(input: unknown): Promise<PendingStaffReminder[]>
    updateMany(input: unknown): Promise<{ count: number }>
  }
}

export interface StaffAppointmentEvent {
  type: Exclude<StaffNotificationType, 'DAILY_SUMMARY'>
  actorId: string
  appointmentId: string
  barberId: string
  barbershopId: string
  barbershopName: string
  timezone: string
  customerName: string
  serviceName: string
  scheduledAt: Date
  previousScheduledAt?: Date
}

interface StaffProcessOptions {
  database?: StaffNotificationDatabase
  now?: Date
}

interface StaffEnqueueOptions extends StaffProcessOptions {
  eventId?: string
}

interface ProcessReminderOptions {
  database?: ReminderDatabase
  now?: Date
}

const reminderKinds = new Map<number, ReminderKind>([[24, '24h'], [2, '2h']])

export async function processAppointmentReminders(
  send: ReminderSend,
  options: ProcessReminderOptions = {},
): Promise<{ sent: number; failed: number; skipped: number }> {
  const database = options.database ?? prisma as unknown as ReminderDatabase
  const now = options.now ?? new Date()
  const appointments = await database.appointment.findMany({
    where: {
      status: { in: ['PENDING', 'CONFIRMED'] },
      scheduledAt: { gt: now, lte: new Date(now.getTime() + 24 * 60 * 60_000) },
      user: { telegramId: { not: null } },
      barbershop: { remindersEnabled: true },
    },
    include: {
      user: { select: { id: true, name: true, telegramId: true } },
      barber: { select: { name: true } },
      service: { select: { name: true } },
      barbershop: {
        select: {
          name: true,
          id: true,
          address: true,
          timezone: true,
          remindersEnabled: true,
          reminderHoursBefore: true,
        },
      },
      reminders: { where: { channel: 'telegram' }, select: { kind: true, channel: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  })
  const result = { sent: 0, failed: 0, skipped: 0 }

  for (const appointment of appointments) {
    const kind = dueReminderKind(appointment, now)
    if (!kind || appointment.reminders.some((item) => item.kind === kind && item.channel === 'telegram')) {
      result.skipped += 1
      continue
    }

    let reminder: { id: string }
    try {
      reminder = await database.appointmentReminder.create({
        data: {
          appointmentId: appointment.id,
          recipientId: appointment.user.id,
          barbershopId: appointment.barbershop.id,
          kind,
          channel: 'telegram',
          deduplicationKey: `customer:${appointment.id}:${appointment.user.id}:${kind}:telegram`,
          availableAt: now,
          sentAt: now,
          deliveredOk: false,
        },
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        result.skipped += 1
        continue
      }
      throw error
    }

    try {
      await send(
        appointment.user.telegramId!,
        reminderMessage(appointment, kind),
        kind === '24h' && appointment.status === 'PENDING' ? {
          reply_markup: {
            inline_keyboard: [[{
              text: '✅ Confirmar presença',
              callback_data: `confirm:${appointment.id}`,
            }]],
          },
        } : undefined,
      )
      await database.appointmentReminder.update({
        where: { id: reminder.id },
        data: { deliveredOk: true, error: null },
      })
      result.sent += 1
    } catch (error) {
      await database.appointmentReminder.update({
        where: { id: reminder.id },
        data: { deliveredOk: false, error: errorMessage(error) },
      })
      result.failed += 1
    }
  }

  return result
}

export async function enqueueStaffAppointmentNotification(
  event: StaffAppointmentEvent,
  options: StaffEnqueueOptions = {},
): Promise<number> {
  const database = options.database ?? prisma as unknown as StaffNotificationDatabase
  const now = options.now ?? new Date()
  const eventId = options.eventId ?? crypto.randomUUID()
  const memberships = await database.membership.findMany({
    where: { barbershopId: event.barbershopId },
    include: { user: { select: { id: true, name: true, telegramId: true } } },
  })
  const recipients = selectStaffRecipients(
    { type: event.type, barberIds: [event.barberId], actorId: event.actorId },
    memberships.map((membership) => ({
      userId: membership.userId,
      role: membership.role,
      notificationTypes: membership.notificationTypes,
      telegramId: membership.user.telegramId,
    })),
  )
  let queued = 0
  for (const recipient of recipients) {
    try {
      await database.appointmentReminder.create({
        data: {
          appointmentId: event.appointmentId,
          recipientId: recipient.userId,
          barbershopId: event.barbershopId,
          kind: `staff:${staffKind(event.type)}`,
          channel: 'telegram',
          deduplicationKey: `staff:${eventId}:${recipient.userId}:${event.type}`,
          message: staffEventMessage(event),
          availableAt: new Date(now.getTime() + 2 * 60_000),
          sentAt: now,
          deliveredOk: false,
        },
      })
      queued += 1
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error
    }
  }
  return queued
}

export async function enqueueDailyStaffSummaries(
  options: StaffProcessOptions = {},
): Promise<number> {
  const database = options.database ?? prisma as unknown as StaffNotificationDatabase
  const now = options.now ?? new Date()
  const memberships = await database.membership.findMany({
    where: {
      notificationTypes: { has: 'DAILY_SUMMARY' },
      user: { telegramId: { not: null } },
    },
    include: {
      user: { select: { id: true, name: true, telegramId: true } },
      barbershop: { select: { id: true, name: true, timezone: true } },
    },
  })
  let queued = 0
  for (const membership of memberships) {
    if (!membership.user.telegramId || !membership.notificationTypes.includes('DAILY_SUMMARY')) continue
    const localDate = dailySummaryDateIfDue(now, membership.barbershop.timezone, membership.dailySummaryTime)
    if (!localDate) continue
    const appointments = await database.appointment.findMany({
      where: {
        barbershopId: membership.barbershop.id,
        ...(membership.role === 'BARBER' ? { barberId: membership.userId } : {}),
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledAt: {
          gte: dateAtLocalTime(localDate, '00:00', membership.barbershop.timezone),
          lt: dateAtLocalTime(nextDate(localDate), '00:00', membership.barbershop.timezone),
        },
      },
      include: { service: { select: { duration: true } }, user: { select: { name: true } } },
      orderBy: { scheduledAt: 'asc' },
    })
    try {
      await database.appointmentReminder.create({
        data: {
          recipientId: membership.userId,
          barbershopId: membership.barbershop.id,
          kind: 'staff:daily-summary',
          channel: 'telegram',
          deduplicationKey: `staff:daily:${membership.barbershop.id}:${membership.userId}:${localDate}`,
          message: buildDailySummary({
            barbershopName: membership.barbershop.name,
            recipientName: membership.user.name,
            timezone: membership.barbershop.timezone,
            consolidated: membership.role !== 'BARBER',
            appointments: appointments.map((appointment) => ({
              scheduledAt: appointment.scheduledAt,
              duration: appointment.service.duration,
              customerName: appointment.user.name,
            })),
          }),
          availableAt: now,
          sentAt: now,
          deliveredOk: false,
        },
      })
      queued += 1
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error
    }
  }
  return queued
}

export async function processStaffNotifications(
  send: ReminderSend,
  options: StaffProcessOptions = {},
): Promise<{ sent: number; failed: number; skipped: number }> {
  const database = options.database ?? prisma as unknown as StaffNotificationDatabase
  const now = options.now ?? new Date()
  const pending = await database.appointmentReminder.findMany({
    where: { kind: { startsWith: 'staff:' }, processedAt: null, availableAt: { lte: now } },
    include: { recipient: { select: { telegramId: true } } },
    orderBy: { availableAt: 'asc' },
  })
  const result = { sent: 0, failed: 0, skipped: 0 }
  const withoutChannel = pending.filter((item) => !item.recipient.telegramId || !item.message)
  for (const item of withoutChannel) {
    await database.appointmentReminder.updateMany({
      where: { id: { in: [item.id] }, processedAt: null },
      data: { processedAt: now, sentAt: now, deliveredOk: false, error: 'Canal Telegram não vinculado' },
    })
    result.skipped += 1
  }
  const groups = groupStaffNotifications(pending
    .filter((item) => item.recipient.telegramId && item.message)
    .map((item) => ({
      id: item.id,
      recipientId: item.recipientId,
      barbershopId: item.barbershopId,
      telegramId: item.recipient.telegramId!,
      message: item.message!,
    })))
  for (const group of groups) {
    try {
      await send(group.telegramId, group.message)
      await database.appointmentReminder.updateMany({
        where: { id: { in: group.ids }, processedAt: null },
        data: { processedAt: now, sentAt: now, deliveredOk: true, error: null },
      })
      result.sent += 1
    } catch (error) {
      await database.appointmentReminder.updateMany({
        where: { id: { in: group.ids }, processedAt: null },
        data: { processedAt: now, sentAt: now, deliveredOk: false, error: errorMessage(error) },
      })
      result.failed += 1
    }
  }
  return result
}

export async function confirmAppointmentFromTelegram(
  appointmentId: string,
  telegramId: string,
  database: ReminderDatabase = prisma as unknown as ReminderDatabase,
): Promise<'confirmed' | 'unchanged' | 'not_found'> {
  const appointment = await database.appointment.findFirst({
    where: { id: appointmentId, user: { telegramId } },
    select: { id: true, status: true },
  })
  if (!appointment) return 'not_found'
  if (appointment.status !== 'PENDING') return 'unchanged'

  const updated = await database.appointment.updateMany({
    where: { id: appointment.id, status: 'PENDING', user: { telegramId } },
    data: { status: 'CONFIRMED', customerConfirmedAt: new Date() },
  })
  return updated.count === 1 ? 'confirmed' : 'unchanged'
}

export function startReminderScheduler(send: ReminderSend): () => void {
  let running = false
  const run = async () => {
    if (running) return
    running = true
    try {
      const recurring = await processRecurringBookings()
      const customer = await processAppointmentReminders(send)
      await enqueueDailyStaffSummaries()
      const staff = await processStaffNotifications(send)
      if (customer.sent || customer.failed || staff.sent || staff.failed || recurring.created || recurring.pending) {
        console.log(`Lembretes: ${customer.sent} clientes e ${staff.sent} equipe enviados; ${customer.failed + staff.failed} falharam; recorrências ${recurring.created} criadas e ${recurring.pending} pendentes`)
      }
    } catch (error) {
      console.error('Falha ao processar lembretes', error)
    } finally {
      running = false
    }
  }
  void run()
  const interval = setInterval(() => void run(), 5 * 60_000)
  interval.unref()
  return () => clearInterval(interval)
}

function dueReminderKind(appointment: ReminderAppointment, now: Date): ReminderKind | null {
  if (!['PENDING', 'CONFIRMED'].includes(appointment.status)
    || !appointment.user.telegramId
    || !appointment.barbershop.remindersEnabled) return null

  const remainingHours = (appointment.scheduledAt.getTime() - now.getTime()) / 3_600_000
  if (remainingHours <= 0) return null
  const configured = appointment.barbershop.reminderHoursBefore
    .filter((hours) => reminderKinds.has(hours))
    .sort((left, right) => left - right)
  const dueHours = configured.find((hours) => remainingHours <= hours)
  return dueHours ? reminderKinds.get(dueHours)! : null
}

function reminderMessage(appointment: ReminderAppointment, kind: ReminderKind): string {
  const date = new Intl.DateTimeFormat('pt-BR', {
    timeZone: appointment.barbershop.timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(appointment.scheduledAt)
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: appointment.barbershop.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(appointment.scheduledAt)
  const anticipation = kind === '24h' ? 'amanhã' : 'em cerca de 2 horas'
  return [
    `Olá, ${appointment.user.name}! 💈`,
    '',
    `Lembrete: seu atendimento na ${appointment.barbershop.name} é ${anticipation}.`,
    `Serviço: ${appointment.service.name}`,
    `Barbeiro: ${appointment.barber.name}`,
    `Data: ${date}`,
    `Horário: ${time}`,
    `Endereço: ${appointment.barbershop.address || 'consulte a barbearia'}`,
  ].join('\n')
}

function staffKind(type: Exclude<StaffNotificationType, 'DAILY_SUMMARY'>): string {
  return ({
    NEW_APPOINTMENT: 'new-appointment',
    CANCELLATION: 'cancellation',
    RESCHEDULE: 'reschedule',
    NO_SHOW: 'no-show',
  } as const)[type]
}

function staffEventMessage(event: StaffAppointmentEvent): string {
  const time = formatAppointmentTime(event.scheduledAt, event.timezone)
  if (event.type === 'NEW_APPOINTMENT') return `Novo agendamento: ${event.customerName} · ${event.serviceName} · ${time}.`
  if (event.type === 'CANCELLATION') return `Cancelamento: ${event.customerName} · ${event.serviceName} · ${time}.`
  if (event.type === 'NO_SHOW') return `Falta registrada: ${event.customerName} · ${event.serviceName} · ${time}.`
  const previous = event.previousScheduledAt ? formatAppointmentTime(event.previousScheduledAt, event.timezone) : 'horário anterior'
  return `Remarcação: ${event.customerName} · ${event.serviceName} · saiu de ${previous} e entrou em ${time}.`
}

function formatAppointmentTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

function nextDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + 24 * 60 * 60_000).toISOString().slice(0, 10)
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 2_000)
  return String(error).slice(0, 2_000)
}
