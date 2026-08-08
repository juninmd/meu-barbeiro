import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fitNow, scheduleWalkInQueue } from './walk-in-queue.js'

const instant = (hour: number, minute = 0) => new Date(Date.UTC(2026, 7, 5, hour, minute))

describe('fitNow', () => {
  it('fits immediately when the whole service ends before the next appointment', () => {
    const result = fitNow({
      now: instant(10),
      duration: 30,
      endOfDay: instant(18),
      isAvailable: (start, duration) => start.getTime() + duration * 60_000 <= instant(11).getTime(),
    })

    assert.deepEqual(result, {
      fitsNow: true,
      nextAvailableAt: instant(10),
      currentServiceMinutesLeft: 0,
    })
  })

  it('reports the current confirmed service remaining time and the next valid opening', () => {
    const result = fitNow({
      now: instant(10, 10),
      duration: 30,
      endOfDay: instant(18),
      currentServiceEndsAt: instant(10, 45),
      isAvailable: (start) => start >= instant(11),
    })

    assert.deepEqual(result, {
      fitsNow: false,
      nextAvailableAt: instant(11),
      currentServiceMinutesLeft: 35,
    })
  })

  it('returns no opening when lunch, absence or closing blocks the rest of the day', () => {
    const result = fitNow({
      now: instant(17, 40),
      duration: 30,
      endOfDay: instant(18),
      isAvailable: () => false,
    })

    assert.equal(result.fitsNow, false)
    assert.equal(result.nextAvailableAt, null)
  })
})

describe('scheduleWalkInQueue', () => {
  it('keeps arrival order and leaves booked appointments untouched', () => {
    const bookedStart = instant(10, 30).getTime()
    const bookedEnd = instant(11).getTime()
    const result = scheduleWalkInQueue({
      now: instant(10),
      endOfDay: instant(13),
      barberIds: ['barber-1'],
      entries: [
        { id: 'first', arrivedAt: instant(9, 50), duration: 45, barberId: null },
        { id: 'second', arrivedAt: instant(9, 55), duration: 30, barberId: null },
      ],
      isAvailable: (_barberId, start, duration) => {
        const end = start.getTime() + duration * 60_000
        return end <= bookedStart || start.getTime() >= bookedEnd
      },
    })

    assert.deepEqual(result.map(({ id, position, estimatedMinutes, startsAt }) => ({ id, position, estimatedMinutes, startsAt })), [
      { id: 'first', position: 1, estimatedMinutes: 60, startsAt: instant(11) },
      { id: 'second', position: 2, estimatedMinutes: 105, startsAt: instant(11, 45) },
    ])
  })

  it('honors barber preference while assigning an unbound customer to the earliest chair', () => {
    const result = scheduleWalkInQueue({
      now: instant(10),
      endOfDay: instant(12),
      barberIds: ['barber-1', 'barber-2'],
      entries: [
        { id: 'preferred', arrivedAt: instant(9, 50), duration: 30, barberId: 'barber-1' },
        { id: 'any', arrivedAt: instant(9, 55), duration: 30, barberId: null },
      ],
      isAvailable: () => true,
    })

    assert.equal(result[0]?.assignedBarberId, 'barber-1')
    assert.equal(result[0]?.estimatedMinutes, 0)
    assert.equal(result[1]?.assignedBarberId, 'barber-2')
    assert.equal(result[1]?.estimatedMinutes, 0)
  })
})
