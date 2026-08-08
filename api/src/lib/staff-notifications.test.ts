import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildDailySummary,
  dailySummaryDateIfDue,
  groupStaffNotifications,
  selectStaffRecipients,
  type StaffMembership,
  type StaffNotificationType,
} from './staff-notifications.js'

const allTypes: StaffNotificationType[] = [
  'NEW_APPOINTMENT',
  'CANCELLATION',
  'RESCHEDULE',
  'NO_SHOW',
  'DAILY_SUMMARY',
]

const memberships: StaffMembership[] = [
  { userId: 'barber-1', role: 'BARBER', notificationTypes: allTypes, telegramId: '101' },
  { userId: 'barber-2', role: 'BARBER', notificationTypes: allTypes, telegramId: '102' },
  { userId: 'owner-1', role: 'OWNER', notificationTypes: allTypes, telegramId: '103' },
  { userId: 'admin-1', role: 'ADMIN', notificationTypes: allTypes, telegramId: '104' },
]

describe('staff notification rules', () => {
  for (const type of ['NEW_APPOINTMENT', 'RESCHEDULE', 'NO_SHOW'] as const) {
    it(`${type} selects only the responsible barber`, () => {
      const recipients = selectStaffRecipients({ type, barberIds: ['barber-1'], actorId: 'customer-1' }, memberships)
      assert.deepEqual(recipients.map((item) => item.userId), ['barber-1'])
    })
  }

  it('cancellation selects the barber and operation managers without duplicates', () => {
    const recipients = selectStaffRecipients({ type: 'CANCELLATION', barberIds: ['barber-1'], actorId: 'customer-1' }, memberships)
    assert.deepEqual(recipients.map((item) => item.userId), ['barber-1', 'owner-1', 'admin-1'])
  })

  it('does not notify the person who performed the action', () => {
    const recipients = selectStaffRecipients({ type: 'NEW_APPOINTMENT', barberIds: ['barber-1'], actorId: 'barber-1' }, memberships)
    assert.deepEqual(recipients, [])
  })

  it('honors each type independently and ignores a missing channel', () => {
    const candidates: StaffMembership[] = [
      { userId: 'barber-1', role: 'BARBER', notificationTypes: ['CANCELLATION'], telegramId: '101' },
      { userId: 'barber-2', role: 'BARBER', notificationTypes: allTypes, telegramId: null },
    ]
    assert.deepEqual(
      selectStaffRecipients({ type: 'NEW_APPOINTMENT', barberIds: ['barber-1'], actorId: 'customer-1' }, candidates),
      [],
    )
    assert.deepEqual(
      selectStaffRecipients({ type: 'CANCELLATION', barberIds: ['barber-1'], actorId: 'customer-1' }, candidates)
        .map((item) => item.userId),
      ['barber-1'],
    )
    assert.deepEqual(
      selectStaffRecipients({ type: 'NEW_APPOINTMENT', barberIds: ['barber-2'], actorId: 'customer-1' }, candidates),
      [],
    )
  })

  it('groups nearby events for the same person into one message', () => {
    const groups = groupStaffNotifications([
      { id: '1', recipientId: 'barber-1', barbershopId: 'shop-1', telegramId: '101', message: 'Ana cancelou 09:00.' },
      { id: '2', recipientId: 'barber-1', barbershopId: 'shop-1', telegramId: '101', message: 'Bia cancelou 10:00.' },
      { id: '3', recipientId: 'barber-2', barbershopId: 'shop-1', telegramId: '102', message: 'Caio cancelou 11:00.' },
    ])
    assert.equal(groups.length, 2)
    assert.deepEqual(groups[0]?.ids, ['1', '2'])
    assert.match(groups[0]?.message ?? '', /2 atualizações na agenda/)
    assert.match(groups[0]?.message ?? '', /Ana cancelou 09:00/)
    assert.match(groups[0]?.message ?? '', /Bia cancelou 10:00/)
  })
})

describe('daily staff summary', () => {
  it('becomes due in the barbershop timezone independently of the machine timezone', () => {
    const before = new Date('2026-08-10T09:59:00.000Z')
    const due = new Date('2026-08-10T10:00:00.000Z')
    assert.equal(dailySummaryDateIfDue(before, 'America/Sao_Paulo', '07:00'), null)
    assert.equal(dailySummaryDateIfDue(due, 'America/Sao_Paulo', '07:00'), '2026-08-10')
  })

  it('reports clients, first and last times, and gaps in local time', () => {
    const message = buildDailySummary({
      barbershopName: 'Barbearia Central',
      recipientName: 'Rafael',
      timezone: 'America/Sao_Paulo',
      consolidated: false,
      appointments: [
        { scheduledAt: new Date('2026-08-10T12:00:00.000Z'), duration: 30, customerName: 'Ana' },
        { scheduledAt: new Date('2026-08-10T13:00:00.000Z'), duration: 45, customerName: 'Bia' },
      ],
    })
    assert.match(message, /2 clientes/)
    assert.match(message, /Primeiro horário: 09:00/)
    assert.match(message, /Último horário: 10:00/)
    assert.match(message, /Buracos: 09:30–10:00/)
  })
})
