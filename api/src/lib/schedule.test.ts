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

const timezone = 'America/Sao_Paulo'

const localInstant = (date: string, time: string): Date => {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const target = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0)
  let timestamp = target

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]))
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    )
    timestamp += target - represented
  }

  return new Date(timestamp)
}

describe('availabilitySlots', () => {
  it('returns a closed day without slots', () => {
    assert.deepEqual(availabilitySlots({
      date: '2026-08-06',
      duration: 30,
      timezone,
      businessHours,
      now: localInstant('2026-08-01', '09:00'),
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
      timezone,
      businessHours,
      now: localInstant('2026-08-01', '09:00'),
    })

    assert.deepEqual(result.slots.map((slot) => slot.label), ['09:00', '09:15', '09:30'])
  })

  it('removes a slot that overlaps an existing appointment', () => {
    const result = availabilitySlots({
      date: '2026-08-05',
      duration: 15,
      timezone,
      businessHours,
      scheduled: [{ scheduledAt: localInstant('2026-08-05', '09:30'), duration: 15 }],
      now: localInstant('2026-08-01', '09:00'),
    })

    assert.deepEqual(result.slots.map((slot) => slot.label), ['09:00', '09:15', '09:45'])
  })

  it('removes only slots that overlap a barber absence', () => {
    const result = availabilitySlots({
      date: '2026-08-05',
      duration: 15,
      timezone,
      businessHours,
      absences: [{
        startsAt: localInstant('2026-08-05', '09:30'),
        endsAt: localInstant('2026-08-05', '09:45'),
        reason: 'Curso',
      }],
      now: localInstant('2026-08-01', '09:00'),
    })

    assert.deepEqual(result.slots.map((slot) => slot.label), ['09:00', '09:15', '09:45'])
  })

  it('returns UTC timestamps and labels in the barbershop timezone', () => {
    const result = availabilitySlots({
      date: '2026-08-05',
      duration: 30,
      timezone,
      businessHours,
      now: localInstant('2026-08-01', '09:00'),
    })

    assert.deepEqual(result.slots[0], {
      scheduledAt: localInstant('2026-08-05', '09:00'),
      label: '09:00',
    })
  })

  it('does not offer slots that overlap the lunch break', () => {
    const result = availabilitySlots({
      date: '2026-08-05',
      duration: 30,
      timezone,
      businessHours: [{
        weekday: 3,
        opensAt: '09:00',
        closesAt: '14:00',
        breakStartsAt: '12:00',
        breakEndsAt: '13:00',
        enabled: true,
      }],
      now: localInstant('2026-08-01', '09:00'),
    })

    const labels = result.slots.map((slot) => slot.label)
    assert.equal(labels.includes('11:30'), true)
    assert.equal(labels.includes('11:45'), false)
    assert.equal(labels.includes('12:00'), false)
    assert.equal(labels.includes('12:30'), false)
    assert.equal(labels.includes('12:45'), false)
    assert.equal(labels.includes('13:00'), true)
  })

  it('does not offer slots on a holiday', () => {
    const result = availabilitySlots({
      date: '2026-08-05',
      duration: 30,
      timezone,
      businessHours,
      holidays: [{ date: new Date('2026-08-05T00:00:00.000Z'), description: 'Aniversário da cidade' }],
      now: localInstant('2026-08-01', '09:00'),
    })

    assert.deepEqual(result, {
      open: false,
      reason: 'A barbearia não abre em 05/08 (Aniversário da cidade)',
      slots: [],
    })
  })
})

describe('validateBusinessHours', () => {
  it('uses the tenant timezone and configured opening hours', () => {
    const businessHours = [
      { weekday: 5, opensAt: '10:00', closesAt: '18:00', enabled: true },
    ]

    assert.equal(validateBusinessHours({
      scheduledAt: localInstant('2026-07-17', '10:00'),
      duration: 30,
      timezone,
      businessHours,
      now: localInstant('2026-07-16', '09:00'),
    }), null)
    assert.match(validateBusinessHours({
      scheduledAt: localInstant('2026-07-17', '17:45'),
      duration: 30,
      timezone,
      businessHours,
      now: localInstant('2026-07-16', '09:00'),
    }) ?? '', /10:00 e 18:00/)
    assert.match(validateBusinessHours({
      scheduledAt: localInstant('2026-07-18', '10:00'),
      duration: 30,
      timezone,
      businessHours,
      now: localInstant('2026-07-16', '09:00'),
    }) ?? '', /não atende/)
  })
})

describe('validateAppointmentSchedule', () => {
  it('rejects a time outside the barber schedule without expanding business hours', () => {
    assert.deepEqual(validateAppointmentSchedule({
      scheduledAt: localInstant('2026-08-05', '09:00'),
      duration: 30,
      timezone,
      businessHours: [{ weekday: 3, opensAt: '09:00', closesAt: '18:00', enabled: true }],
      barberSchedule: [{ weekday: 3, startsAt: '10:00', endsAt: '22:00', enabled: true }],
      now: localInstant('2026-08-01', '09:00'),
    }), {
      code: 'barber_schedule',
      message: 'Este barbeiro não atende neste horário',
    })

    assert.deepEqual(validateAppointmentSchedule({
      scheduledAt: localInstant('2026-08-05', '17:45'),
      duration: 30,
      timezone,
      businessHours: [{ weekday: 3, opensAt: '09:00', closesAt: '18:00', enabled: true }],
      barberSchedule: [{ weekday: 3, startsAt: '10:00', endsAt: '22:00', enabled: true }],
      now: localInstant('2026-08-01', '09:00'),
    }), {
      code: 'hours',
      message: 'Escolha um horário entre 09:00 e 18:00',
    })
  })

  it('keeps business hours as fallback when the barber has no schedule', () => {
    assert.equal(validateAppointmentSchedule({
      scheduledAt: localInstant('2026-08-05', '09:00'),
      duration: 30,
      timezone,
      businessHours,
      barberSchedule: [],
      now: localInstant('2026-08-01', '09:00'),
    }), null)
  })

  it('rejects only absences that overlap the requested interval', () => {
    const absence = {
      startsAt: localInstant('2026-08-05', '09:30'),
      endsAt: localInstant('2026-08-05', '10:00'),
      reason: 'Consulta médica',
    }
    assert.deepEqual(validateAppointmentSchedule({
      scheduledAt: localInstant('2026-08-05', '09:15'),
      duration: 30,
      timezone,
      businessHours,
      absences: [absence],
      now: localInstant('2026-08-01', '09:00'),
    }), {
      code: 'barber_absence',
      message: 'Barbeiro indisponível: Consulta médica',
    })
    assert.equal(validateAppointmentSchedule({
      scheduledAt: localInstant('2026-08-05', '09:00'),
      duration: 30,
      timezone,
      businessHours,
      absences: [absence],
      now: localInstant('2026-08-01', '09:00'),
    }), null)
  })

  it('does not treat the appointment being rescheduled as a conflict', () => {
    assert.equal(validateAppointmentSchedule({
      scheduledAt: localInstant('2026-08-05', '09:00'),
      duration: 30,
      timezone,
      businessHours,
      scheduled: [{
        id: 'appointment-1',
        scheduledAt: localInstant('2026-08-05', '09:00'),
        duration: 30,
      }],
      excludeAppointmentId: 'appointment-1',
      now: localInstant('2026-08-01', '09:00'),
    }), null)
  })

  it('rejects a conflict with another appointment', () => {
    assert.deepEqual(validateAppointmentSchedule({
      scheduledAt: localInstant('2026-08-05', '09:15'),
      duration: 30,
      timezone,
      businessHours,
      scheduled: [{
        scheduledAt: localInstant('2026-08-05', '09:00'),
        duration: 30,
      }],
      now: localInstant('2026-08-01', '09:00'),
    }), {
      code: 'conflict',
      message: 'Este horário acabou de ser reservado',
    })
  })

  it('rejects a time outside business hours', () => {
    assert.deepEqual(validateAppointmentSchedule({
      scheduledAt: localInstant('2026-08-05', '10:45'),
      duration: 30,
      timezone,
      businessHours,
      now: localInstant('2026-08-01', '09:00'),
    }), {
      code: 'hours',
      message: 'Escolha um horário entre 09:00 e 10:00',
    })
  })

  it('rejects an appointment that starts before lunch and overlaps the break', () => {
    assert.deepEqual(validateAppointmentSchedule({
      scheduledAt: localInstant('2026-08-05', '11:45'),
      duration: 30,
      timezone,
      businessHours: [{
        weekday: 3,
        opensAt: '09:00',
        closesAt: '18:00',
        breakStartsAt: '12:00',
        breakEndsAt: '13:00',
        enabled: true,
      }],
      now: localInstant('2026-08-01', '09:00'),
    }), {
      code: 'hours',
      message: 'Escolha um horário fora do intervalo de 12:00 a 13:00',
    })
  })

  it('accepts an appointment that fits entirely before lunch', () => {
    assert.equal(validateAppointmentSchedule({
      scheduledAt: localInstant('2026-08-05', '11:30'),
      duration: 30,
      timezone,
      businessHours: [{
        weekday: 3,
        opensAt: '09:00',
        closesAt: '18:00',
        breakStartsAt: '12:00',
        breakEndsAt: '13:00',
        enabled: true,
      }],
      now: localInstant('2026-08-01', '09:00'),
    }), null)
  })

  it('accepts an appointment that starts after lunch', () => {
    assert.equal(validateAppointmentSchedule({
      scheduledAt: localInstant('2026-08-05', '13:00'),
      duration: 30,
      timezone,
      businessHours: [{
        weekday: 3,
        opensAt: '09:00',
        closesAt: '18:00',
        breakStartsAt: '12:00',
        breakEndsAt: '13:00',
        enabled: true,
      }],
      now: localInstant('2026-08-01', '09:00'),
    }), null)
  })

  it('rejects a holiday with its name in the message', () => {
    assert.deepEqual(validateAppointmentSchedule({
      scheduledAt: localInstant('2026-12-25', '09:00'),
      duration: 30,
      timezone,
      businessHours: [{ weekday: 5, opensAt: '09:00', closesAt: '18:00', enabled: true }],
      holidays: [{ date: new Date('2026-12-25T00:00:00.000Z'), description: 'Natal' }],
      now: localInstant('2026-08-01', '09:00'),
    }), {
      code: 'holiday',
      message: 'A barbearia não abre em 25/12 (Natal)',
    })
  })
})

describe('validateRescheduleStatus', () => {
  it('rejects cancelled, completed and no-show appointments', () => {
    assert.equal(validateRescheduleStatus('CANCELLED'), 'Este agendamento não pode ser remarcado')
    assert.equal(validateRescheduleStatus('DONE'), 'Este agendamento não pode ser remarcado')
    assert.equal(validateRescheduleStatus('NO_SHOW'), 'Este agendamento não pode ser remarcado')
  })
})
