import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildCancellationReport } from './cancellation-report.js'

describe('cancellation report', () => {
  it('separates author and timing and ranks customers, weekdays and hours', () => {
    const result = buildCancellationReport({
      from: '2026-08-01',
      to: '2026-08-31',
      timezone: 'America/Sao_Paulo',
      cancellationWindowHours: 6,
      cancellations: [
        cancellation('CUSTOMER', 2, 1_000, '2026-08-03T12:00:00.000Z', 'customer-1', 'Marina'),
        cancellation('CUSTOMER', 24, 0, '2026-08-03T12:30:00.000Z', 'customer-1', 'Marina'),
        cancellation('BARBER', 1, 0, '2026-08-04T15:00:00.000Z', 'customer-2', 'Pedro'),
      ],
    })

    assert.equal(result.total, 3)
    assert.deepEqual(result.byCancelledBy, { CUSTOMER: 2, BARBER: 1, OWNER: 0, ADMIN: 0 })
    assert.deepEqual(result.byTiming, { late: 2, advance: 1 })
    assert.equal(result.lostRevenueCents, 15_000)
    assert.equal(result.retainedFeeCents, 1_000)
    assert.deepEqual(result.topCustomers[0], { id: 'customer-1', name: 'Marina', cancellations: 2 })
    assert.deepEqual(result.byWeekday[0], { weekday: 1, label: 'segunda-feira', cancellations: 2 })
    assert.deepEqual(result.byHour[0], { hour: 9, label: '09h', cancellations: 2 })
    assert.equal(result.waitlistReused, 0)
  })
})

function cancellation(role: string, hoursBefore: number, feeCents: number, scheduledAt: string, userId: string, name: string) {
  return {
    cancelledByRole: role,
    hoursBefore,
    feeCents,
    appointment: {
      scheduledAt: new Date(scheduledAt),
      service: { priceCents: 5_000 },
      user: { id: userId, name },
    },
  }
}
