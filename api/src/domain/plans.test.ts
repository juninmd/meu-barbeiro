import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  SAAS_PLANS,
  monthlyFeeForPlan,
  planById,
  professionalLimit,
  subscriptionSnapshot,
  trialEndsAt,
  isSubscriptionGated,
  TRIAL_DAYS,
} from './plans.js'

const trialShop = (overrides: Partial<Parameters<typeof subscriptionSnapshot>[0]> = {}) => ({
  plan: 'STARTER',
  subscriptionStatus: 'TRIALING',
  trialEndsAt: new Date('2026-11-14T12:00:00.000Z'),
  monthlyFeeCents: 4_990,
  ...overrides,
})

describe('plans catalog', () => {
  it('keeps entry price below the brazilian market benchmark', () => {
    assert.equal(SAAS_PLANS.STARTER.monthlyFeeCents, 4_990)
    assert.ok(SAAS_PLANS.STARTER.monthlyFeeCents < 9_990, 'Essencial precisa ser mais barato que Booksy')
    assert.equal(SAAS_PLANS.PRO.monthlyFeeCents, 8_990)
    assert.equal(SAAS_PLANS.SCALE.monthlyFeeCents, 14_990)
  })

  it('charges two months less on the annual cycle', () => {
    for (const plan of Object.values(SAAS_PLANS)) {
      assert.equal(plan.annualFeeCents, plan.monthlyFeeCents * 10)
    }
  })

  it('resolves plans by id and falls back safely', () => {
    assert.equal(planById('PRO')?.id, 'PRO')
    assert.equal(planById('GOLD'), null)
    assert.equal(monthlyFeeForPlan('SCALE'), 14_990)
    assert.equal(monthlyFeeForPlan(undefined), 4_990)
  })

  it('limits team size per plan', () => {
    assert.equal(professionalLimit('STARTER'), 1)
    assert.equal(professionalLimit('PRO'), 5)
    assert.equal(professionalLimit('SCALE'), Number.POSITIVE_INFINITY)
    assert.equal(professionalLimit('UNKNOWN'), 1)
  })
})

describe('subscription lifecycle', () => {
  it('starts a trial that lasts the configured days', () => {
    const now = new Date('2026-10-31T12:00:00.000Z')
    const end = trialEndsAt(now)
    const days = Math.round((end.getTime() - now.getTime()) / 86_400_000)
    assert.equal(days, TRIAL_DAYS)
  })

  it('reports a running trial with the remaining days', () => {
    const snapshot = subscriptionSnapshot(trialShop(), new Date('2026-11-04T12:00:00.000Z'))
    assert.equal(snapshot.state, 'TRIALING')
    assert.equal(snapshot.isActive, true)
    assert.equal(snapshot.isBlocked, false)
    assert.equal(snapshot.trialDaysLeft, 10)
  })

  it('blocks writes when the trial is over', () => {
    const snapshot = subscriptionSnapshot(trialShop(), new Date('2026-11-20T12:00:00.000Z'))
    assert.equal(snapshot.state, 'EXPIRED')
    assert.equal(snapshot.isActive, false)
    assert.equal(snapshot.isBlocked, true)
    assert.equal(snapshot.trialDaysLeft, 0)
  })

  it('keeps an active subscription running regardless of the trial', () => {
    const snapshot = subscriptionSnapshot(
      trialShop({ subscriptionStatus: 'ACTIVE', trialEndsAt: null }),
      new Date('2027-01-01T00:00:00.000Z'),
    )
    assert.equal(snapshot.state, 'ACTIVE')
    assert.equal(snapshot.isBlocked, false)
  })

  it('blocks an active trial as soon as payment fails', () => {
    const snapshot = subscriptionSnapshot(
      trialShop({ subscriptionStatus: 'PAST_DUE' }),
      new Date('2026-11-04T12:00:00.000Z'),
    )
    assert.equal(snapshot.state, 'PAST_DUE')
    assert.equal(snapshot.isBlocked, true)
  })

  it('treats a cancelled subscription as blocked even inside the trial window', () => {
    const snapshot = subscriptionSnapshot(
      trialShop({ subscriptionStatus: 'CANCELED', canceledAt: new Date('2026-11-01T00:00:00.000Z') }),
      new Date('2026-11-04T12:00:00.000Z'),
    )
    assert.equal(snapshot.state, 'CANCELED')
    assert.equal(snapshot.isBlocked, true)
  })

  it('honours a grandfathered monthly fee', () => {
    const snapshot = subscriptionSnapshot(trialShop({ monthlyFeeCents: 2_000 }))
    assert.equal(snapshot.monthlyFeeCents, 2_000)
  })
})

describe('subscription gate', () => {
  it('blocks staff writes but never reads', () => {
    assert.equal(isSubscriptionGated('POST', '/services'), true)
    assert.equal(isSubscriptionGated('DELETE', '/products/abc'), true)
    assert.equal(isSubscriptionGated('PATCH', '/barbershops/current'), true)
    assert.equal(isSubscriptionGated('GET', '/services'), false)
  })

  it('never blocks billing, signup, team removal or invitations', () => {
    assert.equal(isSubscriptionGated('POST', '/billing/mercado-pago/subscription'), false)
    assert.equal(isSubscriptionGated('POST', '/barbershops'), false)
    assert.equal(isSubscriptionGated('DELETE', '/barbershops/current/team/user-1'), false)
    assert.equal(isSubscriptionGated('POST', '/barbershops/current/invitations'), false)
  })
})
