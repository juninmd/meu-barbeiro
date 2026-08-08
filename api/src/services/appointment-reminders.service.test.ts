import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  confirmAppointmentFromTelegram,
  processAppointmentReminders,
  type ReminderDatabase,
  type ReminderSend,
} from './appointment-reminders.service.js'

const now = new Date('2026-08-09T12:00:00.000Z')

const appointment = (overrides: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  scheduledAt: new Date('2026-08-10T12:00:00.000Z'),
  status: 'PENDING',
  user: { name: 'Marina Costa', telegramId: '1001' },
  barber: { name: 'Rafael Navalha' },
  service: { name: 'Corte assinatura' },
  barbershop: {
    name: 'Barbearia Central',
    address: 'Rua das Navalhas, 27',
    timezone: 'America/Sao_Paulo',
    remindersEnabled: true,
    reminderHoursBefore: [24, 2],
  },
  reminders: [],
  ...overrides,
})

function fakeDatabase(appointments: ReturnType<typeof appointment>[]) {
  const reminders: Array<{
    id: string
    appointmentId: string
    kind: string
    channel: string
    deliveredOk: boolean
    error: string | null
  }> = []
  const statuses = new Map<string, string>(appointments.map((item) => [item.id, item.status]))
  const customerConfirmations = new Set<string>()
  const database = {
    appointment: {
      findMany: async () => appointments.map((item) => ({
        ...item,
        status: statuses.get(item.id) ?? item.status,
        reminders: reminders.filter((reminder) => reminder.appointmentId === item.id),
      })),
      findFirst: async ({ where }: { where: { id: string; user: { telegramId: string } } }) => {
        const item = appointments.find((candidate) => candidate.id === where.id
          && candidate.user.telegramId === where.user.telegramId)
        return item ? { id: item.id, status: statuses.get(item.id) ?? item.status } : null
      },
      updateMany: async ({ where, data }: {
        where: { id: string; status: string }
        data: { status: string; customerConfirmedAt?: Date }
      }) => {
        if (statuses.get(where.id) !== where.status) return { count: 0 }
        statuses.set(where.id, data.status)
        if (data.customerConfirmedAt) customerConfirmations.add(where.id)
        return { count: 1 }
      },
    },
    appointmentReminder: {
      create: async ({ data }: { data: { appointmentId: string; kind: string; channel: string } }) => {
        if (reminders.some((item) => item.appointmentId === data.appointmentId
          && item.kind === data.kind && item.channel === data.channel)) {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
        }
        const reminder = { id: crypto.randomUUID(), ...data, deliveredOk: false, error: null }
        reminders.push(reminder)
        return reminder
      },
      update: async ({ where, data }: {
        where: { id: string }
        data: { deliveredOk: boolean; error: string | null }
      }) => {
        const reminder = reminders.find((item) => item.id === where.id)
        assert(reminder)
        Object.assign(reminder, data)
        return reminder
      },
    },
  } as unknown as ReminderDatabase
  return { database, reminders, statuses, customerConfirmations }
}

describe('appointment reminders', () => {
  it('selects only the due window and does not send the same kind twice', async () => {
    const due24h = appointment()
    const due2h = appointment({
      scheduledAt: new Date('2026-08-09T14:00:00.000Z'),
      status: 'CONFIRMED',
      user: { name: 'Pedro Lima', telegramId: '1002' },
    })
    const tooEarly = appointment({
      scheduledAt: new Date('2026-08-10T12:06:00.000Z'),
      user: { name: 'Lucas Rocha', telegramId: '1003' },
    })
    const { database, reminders } = fakeDatabase([due24h, due2h, tooEarly])
    const sent: string[] = []
    const send: ReminderSend = async (telegramId) => { sent.push(telegramId) }

    await processAppointmentReminders(send, { database, now })
    await processAppointmentReminders(send, { database, now })

    assert.deepEqual(sent, ['1001', '1002'])
    assert.deepEqual(reminders.map((item) => [item.appointmentId, item.kind, item.deliveredOk]), [
      [due24h.id, '24h', true],
      [due2h.id, '2h', true],
    ])
  })

  it('records one failure and continues the batch', async () => {
    const first = appointment({ user: { name: 'Marina Costa', telegramId: '1001' } })
    const second = appointment({ user: { name: 'Pedro Lima', telegramId: '1002' } })
    const { database, reminders } = fakeDatabase([first, second])
    const sent: string[] = []

    await processAppointmentReminders(async (telegramId) => {
      sent.push(telegramId)
      if (telegramId === '1001') throw new Error('Telegram indisponível')
    }, { database, now })

    assert.deepEqual(sent, ['1001', '1002'])
    assert.equal(reminders.find((item) => item.appointmentId === first.id)?.deliveredOk, false)
    assert.equal(reminders.find((item) => item.appointmentId === first.id)?.error, 'Telegram indisponível')
    assert.equal(reminders.find((item) => item.appointmentId === second.id)?.deliveredOk, true)
  })

  it('ignores invalid status, missing Telegram and disabled barbershop', async () => {
    const candidates = [
      appointment({ status: 'CANCELLED' }),
      appointment({ status: 'DONE' }),
      appointment({ status: 'NO_SHOW' }),
      appointment({ user: { name: 'Sem Telegram', telegramId: null } }),
      appointment({ barbershop: { ...appointment().barbershop, remindersEnabled: false } }),
    ]
    const { database, reminders } = fakeDatabase(candidates)
    let sends = 0

    await processAppointmentReminders(async () => { sends += 1 }, { database, now })

    assert.equal(sends, 0)
    assert.equal(reminders.length, 0)
  })

  it('formats date and time in the barbershop timezone and adds confirmation to 24h', async () => {
    const due = appointment({ scheduledAt: new Date('2026-08-10T12:00:00.000Z') })
    const { database } = fakeDatabase([due])
    let message = ''
    let callbackData = ''

    await processAppointmentReminders(async (_telegramId, text, options) => {
      message = text
      callbackData = options?.reply_markup?.inline_keyboard[0]?.[0]?.callback_data ?? ''
    }, { database, now })

    assert.match(message, /10\/08\/2026/)
    assert.match(message, /09:00/)
    assert.match(message, /Marina Costa/)
    assert.match(message, /Corte assinatura/)
    assert.match(message, /Rafael Navalha/)
    assert.match(message, /Rua das Navalhas, 27/)
    assert.equal(callbackData, `confirm:${due.id}`)
  })
})

describe('Telegram appointment confirmation', () => {
  it('moves PENDING to CONFIRMED and does not change another state', async () => {
    const pending = appointment()
    const confirmed = appointment({ status: 'CONFIRMED' })
    const { database, statuses, customerConfirmations } = fakeDatabase([pending, confirmed])

    assert.equal(await confirmAppointmentFromTelegram(pending.id, '1001', database), 'confirmed')
    assert.equal(await confirmAppointmentFromTelegram(confirmed.id, '1001', database), 'unchanged')
    assert.equal(statuses.get(pending.id), 'CONFIRMED')
    assert.equal(statuses.get(confirmed.id), 'CONFIRMED')
    assert.equal(customerConfirmations.has(pending.id), true)
    assert.equal(customerConfirmations.has(confirmed.id), false)
  })
})
