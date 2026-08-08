import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canGenerateRecurring, claimMembershipVisit, membershipBenefit, normalizeSubscriptionPeriod, nextRecurringDates } from './customer-membership.js'

const plan = { includedVisits: 2, intervalDays: 30, serviceIds: ['corte'] }
const active = {
  status: 'ACTIVE', visitsUsed: 1,
  currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2026-08-31T00:00:00.000Z'),
}

describe('membershipBenefit', () => {
  it('waives the deposit for a covered visit and restores it after the allowance', () => {
    assert.deepEqual(membershipBenefit(active, plan, 'corte', new Date('2026-08-08T12:00:00.000Z')), { covered: true, remainingVisits: 1 })
    assert.deepEqual(membershipBenefit({ ...active, visitsUsed: 2 }, plan, 'corte', new Date('2026-08-08T12:00:00.000Z')), { covered: false, remainingVisits: 0 })
  })

  it('does not consume benefits for cancelled or past-due subscriptions', () => {
    for (const status of ['CANCELLED', 'PAST_DUE']) {
      assert.deepEqual(membershipBenefit({ ...active, status }, plan, 'corte', new Date('2026-08-08T12:00:00.000Z')), { covered: false, remainingVisits: 0 })
    }
  })

  it('does not cover services outside the plan', () => {
    assert.deepEqual(membershipBenefit(active, plan, 'barba', new Date('2026-08-08T12:00:00.000Z')), { covered: false, remainingVisits: 1 })
  })
})

describe('normalizeSubscriptionPeriod', () => {
  it('resets visits at the period boundary without depending on local timezone', () => {
    assert.deepEqual(normalizeSubscriptionPeriod(active, 30, new Date('2026-09-01T00:00:00.000Z')), {
      currentPeriodStart: new Date('2026-08-31T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-09-30T00:00:00.000Z'),
      visitsUsed: 0,
    })
  })
})

describe('nextRecurringDates', () => {
  it('returns four fixed weekdays deterministically', () => {
    assert.deepEqual(nextRecurringDates(new Date('2026-08-08T12:00:00.000Z'), 1, 4).map((date) => date.toISOString().slice(0, 10)), [
      '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31',
    ])
  })
})

describe('canGenerateRecurring', () => {
  it('stops cancelled, past-due and inactive fixed bookings', () => {
    assert.equal(canGenerateRecurring('ACTIVE', true), true)
    assert.equal(canGenerateRecurring('PAST_DUE', true), false)
    assert.equal(canGenerateRecurring('CANCELLED', true), false)
    assert.equal(canGenerateRecurring('ACTIVE', false), false)
  })
})

describe('claimMembershipVisit', () => {
  it('uses injected storage and increments only a covered active visit', async () => {
    let visitsUsed = 1
    const result = await claimMembershipVisit({
      barbershopId: 'shop', userId: 'customer', serviceId: 'corte', now: new Date('2026-08-08T12:00:00.000Z'),
      database: {
        findSubscription: async () => ({ id: 'subscription', ...active, visitsUsed, plan }),
        updatePeriod: async () => undefined,
        incrementVisit: async (_id, expected) => {
          if (visitsUsed !== expected) return false
          visitsUsed += 1
          return true
        },
      },
    })
    assert.deepEqual(result, { covered: true, remainingVisits: 0, subscriptionId: 'subscription' })
    assert.equal(visitsUsed, 2)
  })
})
