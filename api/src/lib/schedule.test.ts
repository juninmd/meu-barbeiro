import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateBusinessHours } from './schedule.js'

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
