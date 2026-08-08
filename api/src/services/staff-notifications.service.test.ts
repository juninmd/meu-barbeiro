import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  enqueueStaffAppointmentNotification,
  enqueueDailyStaffSummaries,
  processStaffNotifications,
  type StaffNotificationDatabase,
} from './appointment-reminders.service.js'

const now = new Date('2026-08-10T10:00:00.000Z')

function fakeDatabase() {
  const reminders: Array<Record<string, unknown> & { id: string }> = []
  const members = [
    { userId: 'barber-1', role: 'BARBER', notificationTypes: ['NEW_APPOINTMENT', 'CANCELLATION', 'RESCHEDULE', 'NO_SHOW', 'DAILY_SUMMARY'], dailySummaryTime: '07:00', user: { id: 'barber-1', name: 'Rafael', telegramId: '101' }, barbershop: { id: 'shop-1', name: 'Central', timezone: 'America/Sao_Paulo' } },
    { userId: 'owner-1', role: 'OWNER', notificationTypes: ['CANCELLATION', 'DAILY_SUMMARY'], dailySummaryTime: '07:00', user: { id: 'owner-1', name: 'Dona Ana', telegramId: '102' }, barbershop: { id: 'shop-1', name: 'Central', timezone: 'America/Sao_Paulo' } },
    { userId: 'barber-2', role: 'BARBER', notificationTypes: ['NEW_APPOINTMENT'], dailySummaryTime: '07:00', user: { id: 'barber-2', name: 'Caio', telegramId: null }, barbershop: { id: 'shop-1', name: 'Central', timezone: 'America/Sao_Paulo' } },
  ]
  const database = {
    membership: {
      findMany: async () => members,
    },
    appointment: {
      findMany: async ({ where }: { where: { barberId?: string } }) => [
        { scheduledAt: new Date('2026-08-10T12:00:00.000Z'), service: { duration: 30 }, user: { name: where.barberId ? 'Ana' : 'Ana' } },
        { scheduledAt: new Date('2026-08-10T13:00:00.000Z'), service: { duration: 30 }, user: { name: 'Bia' } },
      ],
    },
    appointmentReminder: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (reminders.some((item) => item.deduplicationKey === data.deduplicationKey)) {
          throw Object.assign(new Error('duplicated'), { code: 'P2002' })
        }
        const reminder = { id: `reminder-${reminders.length + 1}`, ...data }
        reminders.push(reminder)
        return reminder
      },
      findMany: async () => reminders
        .filter((item) => !item.processedAt && (item.availableAt as Date) <= now)
        .map((item) => ({ ...item, recipient: { telegramId: members.find((member) => member.userId === item.recipientId)?.user.telegramId ?? null } })),
      updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: Record<string, unknown> }) => {
        reminders.filter((item) => where.id.in.includes(item.id)).forEach((item) => Object.assign(item, data))
        return { count: where.id.in.length }
      },
    },
  } as unknown as StaffNotificationDatabase
  return { database, reminders }
}

describe('staff notification persistence and delivery', () => {
  for (const [type, kind] of [
    ['NEW_APPOINTMENT', 'staff:new-appointment'],
    ['RESCHEDULE', 'staff:reschedule'],
    ['NO_SHOW', 'staff:no-show'],
  ] as const) {
    it(`queues ${type} for the responsible barber`, async () => {
      const { database, reminders } = fakeDatabase()
      await enqueueStaffAppointmentNotification({
        type, actorId: 'customer-1', appointmentId: 'appointment-1', barberId: 'barber-1',
        barbershopId: 'shop-1', barbershopName: 'Central', timezone: 'America/Sao_Paulo',
        customerName: 'Marina', serviceName: 'Corte', scheduledAt: new Date('2026-08-10T12:00:00.000Z'),
        ...(type === 'RESCHEDULE' ? { previousScheduledAt: new Date('2026-08-10T11:00:00.000Z') } : {}),
      }, { database, now, eventId: `event-${type}` })
      assert.deepEqual(reminders.map((item) => [item.recipientId, item.kind]), [['barber-1', kind]])
    })
  }

  it('queues the responsible barber and operation managers according to the event', async () => {
    const { database, reminders } = fakeDatabase()
    await enqueueStaffAppointmentNotification({
      type: 'CANCELLATION', actorId: 'customer-1', appointmentId: 'appointment-1', barberId: 'barber-1',
      barbershopId: 'shop-1', barbershopName: 'Central', timezone: 'America/Sao_Paulo',
      customerName: 'Marina', serviceName: 'Corte', scheduledAt: new Date('2026-08-10T12:00:00.000Z'),
    }, { database, now, eventId: 'event-1' })
    assert.deepEqual(reminders.map((item) => item.recipientId), ['barber-1', 'owner-1'])
    assert(reminders.every((item) => item.availableAt instanceof Date && item.deliveredOk === false))
  })

  it('does not persist an event for the barber who performed it', async () => {
    const { database, reminders } = fakeDatabase()
    await enqueueStaffAppointmentNotification({
      type: 'NEW_APPOINTMENT', actorId: 'barber-1', appointmentId: 'appointment-1', barberId: 'barber-1',
      barbershopId: 'shop-1', barbershopName: 'Central', timezone: 'America/Sao_Paulo',
      customerName: 'Marina', serviceName: 'Corte', scheduledAt: new Date('2026-08-10T12:00:00.000Z'),
    }, { database, now, eventId: 'event-self' })
    assert.deepEqual(reminders, [])
  })

  it('groups nearby events, records success and continues after a recipient failure', async () => {
    const { database, reminders } = fakeDatabase()
    for (const [eventId, appointmentId] of [['event-1', 'appointment-1'], ['event-2', 'appointment-2']] as const) {
      await enqueueStaffAppointmentNotification({
        type: 'CANCELLATION', actorId: 'customer-1', appointmentId, barberId: 'barber-1',
        barbershopId: 'shop-1', barbershopName: 'Central', timezone: 'America/Sao_Paulo',
        customerName: appointmentId, serviceName: 'Corte', scheduledAt: new Date('2026-08-10T12:00:00.000Z'),
      }, { database, now: new Date(now.getTime() - 120_000), eventId })
    }
    const sends: string[] = []
    const result = await processStaffNotifications(async (telegramId, message) => {
      sends.push(`${telegramId}:${message}`)
      if (telegramId === '101') throw new Error('Telegram indisponível')
    }, { database, now })
    assert.equal(sends.length, 2)
    assert(sends.every((item) => item.includes('2 atualizações na agenda')))
    assert.deepEqual(result, { sent: 1, failed: 1, skipped: 0 })
    assert(reminders.filter((item) => item.recipientId === 'barber-1').every((item) => item.error === 'Telegram indisponível'))
    assert(reminders.filter((item) => item.recipientId === 'owner-1').every((item) => item.deliveredOk === true))
  })

  it('queues each daily summary once using the local date', async () => {
    const { database, reminders } = fakeDatabase()
    await enqueueDailyStaffSummaries({ database, now })
    await enqueueDailyStaffSummaries({ database, now })
    const summaries = reminders.filter((item) => item.kind === 'staff:daily-summary')
    assert.equal(summaries.length, 2)
    assert(summaries.every((item) => String(item.deduplicationKey).includes('2026-08-10')))
    assert.match(String(summaries.find((item) => item.recipientId === 'barber-1')?.message), /Buracos: 09:30–10:00/)
    assert.match(String(summaries.find((item) => item.recipientId === 'owner-1')?.message), /Resumo consolidado do dia/)
  })
})
