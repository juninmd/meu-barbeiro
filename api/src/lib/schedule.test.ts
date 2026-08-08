import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  availabilitySlots,
  validateAppointmentSchedule,
  validateBusinessHours,
  validateRescheduleStatus,
} from './schedule.js'

const businessHours = [
  { weekday: 3, opensAt: '09:00', closesAt: '10:00', enabled: true },
]

describe('availabilitySlots', () => {
  it('returns a closed day without slots', () => {
    assert.deepEqual(availabilitySlots({
      date: '2026-08-06',
      duration: 30,
      timezone: 'America/Sao_Paulo',
      businessHours,
      now: new Date('2026-08-01T12:00:00.000Z'),
    }), {
      open: false,
      reason: 'A barbearia não atende neste dia',
      slots: [],
    })
  })

  it('does not return a slot when the service ends after closing', () => {
    const result = availabilitySlots({
      date: '2026-08-05',
      duration: 30,
      timezone: 'America/Sao_Paulo',
      businessHours,
      now: new Date('2026-08-01T12:00:00.000Z'),
    })

    assert.deepEqual(result.slots.map((slot) => slot.label), ['09:00', '09:15', '09:30'])
  })

  it('removes a slot that overlaps an existing appointment', () => {
    const result = availabilitySlots({
      date: '2026-08-05',
      duration: 15,
      timezone: 'America/Sao_Paulo',
      businessHours,
      scheduled: [{ scheduledAt: new Date('2026-08-05T12:30:00.000Z'), duration: 15 }],
      now: new Date('2026-08-01T12:00:00.000Z'),
    })

    assert.deepEqual(result.slots.map((slot) => slot.label), ['09:00', '09:15', '09:45'])
  })

  it('returns UTC timestamps and labels in the barbershop timezone', () => {
    const result = availabilitySlots({
      date: '2026-08-05',
      duration: 30,
      timezone: 'America/Sao_Paulo',
      businessHours,
      now: new Date('2026-08-01T12:00:00.000Z'),
    })

    assert.deepEqual(result.slots[0], {
      scheduledAt: new Date('2026-08-05T12:00:00.000Z'),
      label: '09:00',
    })
  })
})

describe('validateBusinessHours', () => {
  it('uses the tenant timezone and configured opening hours', () => {
    const businessHours = [
      { weekday: 5, opensAt: '10:00', closesAt: '18:00', enabled: true },
    ]

    assert.equal(validateBusinessHours({
      scheduledAt: new Date('2026-07-17T13:00:00.000Z'),
      duration: 30,
      timezone: 'America/Sao_Paulo',
      businessHours,
      now: new Date('2026-07-16T12:00:00.000Z'),
    }), null)
    assert.match(validateBusinessHours({
      scheduledAt: new Date('2026-07-17T20:45:00.000Z'),
      duration: 30,
      timezone: 'America/Sao_Paulo',
      businessHours,
      now: new Date('2026-07-16T12:00:00.000Z'),
    }) ?? '', /10:00 e 18:00/)
    assert.match(validateBusinessHours({
      scheduledAt: new Date('2026-07-18T13:00:00.000Z'),
      duration: 30,
      timezone: 'America/Sao_Paulo',
      businessHours,
      now: new Date('2026-07-16T12:00:00.000Z'),
    }) ?? '', /não atende/)
  })
})

describe('validateAppointmentSchedule', () => {
  it('does not treat the appointment being rescheduled as a conflict', () => {
    assert.equal(validateAppointmentSchedule({
      scheduledAt: new Date('2026-08-05T12:00:00.000Z'),
      duration: 30,
      timezone: 'America/Sao_Paulo',
      businessHours,
      scheduled: [{
        id: 'appointment-1',
        scheduledAt: new Date('2026-08-05T12:00:00.000Z'),
        duration: 30,
      }],
      excludeAppointmentId: 'appointment-1',
      now: new Date('2026-08-01T12:00:00.000Z'),
    }), null)
  })

  it('rejects a conflict with another appointment', () => {
    assert.deepEqual(validateAppointmentSchedule({
      scheduledAt: new Date('2026-08-05T12:15:00.000Z'),
      duration: 30,
      timezone: 'America/Sao_Paulo',
      businessHours,
      scheduled: [{
        scheduledAt: new Date('2026-08-05T12:00:00.000Z'),
        duration: 30,
      }],
      now: new Date('2026-08-01T12:00:00.000Z'),
    }), {
      code: 'conflict',
      message: 'Este horário acabou de ser reservado',
    })
  })

  it('rejects a time outside business hours', () => {
    assert.deepEqual(validateAppointmentSchedule({
      scheduledAt: new Date('2026-08-05T13:45:00.000Z'),
      duration: 30,
      timezone: 'America/Sao_Paulo',
      businessHours,
      now: new Date('2026-08-01T12:00:00.000Z'),
    }), {
      code: 'hours',
      message: 'Escolha um horário entre 09:00 e 10:00',
    })
  })
})

describe('validateRescheduleStatus', () => {
  it('rejects cancelled and completed appointments', () => {
    assert.equal(validateRescheduleStatus('CANCELLED'), 'Este agendamento não pode ser remarcado')
    assert.equal(validateRescheduleStatus('DONE'), 'Este agendamento não pode ser remarcado')
  })
})
