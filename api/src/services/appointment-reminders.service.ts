import { prisma } from '../lib/prisma.js'

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
  user: { name: string; telegramId: string | null }
  barber: { name: string }
  service: { name: string }
  barbershop: {
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
      user: { select: { name: true, telegramId: true } },
      barber: { select: { name: true } },
      service: { select: { name: true } },
      barbershop: {
        select: {
          name: true,
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
          kind,
          channel: 'telegram',
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
      const result = await processAppointmentReminders(send)
      if (result.sent || result.failed) {
        console.log(`Lembretes: ${result.sent} enviados, ${result.failed} falharam`)
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

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 2_000)
  return String(error).slice(0, 2_000)
}
