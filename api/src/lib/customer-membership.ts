import { localDateKey } from './schedule.js'

const dayMilliseconds = 24 * 60 * 60_000

interface SubscriptionPeriod {
  status: string
  visitsUsed: number
  currentPeriodStart: Date
  currentPeriodEnd: Date
}

interface MembershipPlanBenefit {
  includedVisits: number
  intervalDays: number
  serviceIds: string[]
}

export function normalizeSubscriptionPeriod(
  subscription: SubscriptionPeriod,
  intervalDays: number,
  now: Date,
): Pick<SubscriptionPeriod, 'currentPeriodStart' | 'currentPeriodEnd' | 'visitsUsed'> {
  let currentPeriodStart = subscription.currentPeriodStart
  let currentPeriodEnd = subscription.currentPeriodEnd
  let visitsUsed = subscription.visitsUsed
  while (now >= currentPeriodEnd) {
    currentPeriodStart = currentPeriodEnd
    currentPeriodEnd = new Date(currentPeriodStart.getTime() + intervalDays * dayMilliseconds)
    visitsUsed = 0
  }
  return { currentPeriodStart, currentPeriodEnd, visitsUsed }
}

export function membershipBenefit(
  subscription: SubscriptionPeriod,
  plan: MembershipPlanBenefit,
  serviceId: string,
  now: Date,
): { covered: boolean; remainingVisits: number } {
  if (subscription.status !== 'ACTIVE') return { covered: false, remainingVisits: 0 }
  const period = normalizeSubscriptionPeriod(subscription, plan.intervalDays, now)
  const remainingVisits = Math.max(0, plan.includedVisits - period.visitsUsed)
  return {
    covered: now >= period.currentPeriodStart
      && now < period.currentPeriodEnd
      && plan.serviceIds.includes(serviceId)
      && remainingVisits > 0,
    remainingVisits,
  }
}

// Days are the barbershop's local calendar days (as UTC-midnight dates); today is included and the
// caller skips a slot whose time already passed, so a booking made earlier the same day is not lost.
export function nextRecurringDates(now: Date, weekday: number, count: number, timezone = 'UTC'): Date[] {
  const cursor = new Date(`${localDateKey(now, timezone)}T00:00:00.000Z`)
  const daysUntil = (weekday - cursor.getUTCDay() + 7) % 7
  cursor.setUTCDate(cursor.getUTCDate() + daysUntil)
  return Array.from({ length: count }, (_, index) => new Date(cursor.getTime() + index * 7 * dayMilliseconds))
}

export function canGenerateRecurring(status: string, active: boolean): boolean {
  return active && status === 'ACTIVE'
}

interface StoredSubscription extends SubscriptionPeriod {
  id: string
  plan: MembershipPlanBenefit
}

export interface MembershipVisitDatabase {
  findSubscription(barbershopId: string, userId: string): Promise<StoredSubscription | null>
  updatePeriod(id: string, period: Pick<SubscriptionPeriod, 'currentPeriodStart' | 'currentPeriodEnd' | 'visitsUsed'>): Promise<void>
  incrementVisit(id: string, expectedVisitsUsed: number): Promise<boolean>
}

export async function claimMembershipVisit(input: {
  database: MembershipVisitDatabase
  barbershopId: string
  userId: string
  serviceId: string
  now: Date
}): Promise<{ covered: boolean; remainingVisits: number; subscriptionId: string | null }> {
  const subscription = await input.database.findSubscription(input.barbershopId, input.userId)
  if (!subscription) return { covered: false, remainingVisits: 0, subscriptionId: null }
  const period = normalizeSubscriptionPeriod(subscription, subscription.plan.intervalDays, input.now)
  if (period.currentPeriodStart.getTime() !== subscription.currentPeriodStart.getTime()) {
    await input.database.updatePeriod(subscription.id, period)
  }
  const normalized = { ...subscription, ...period }
  const benefit = membershipBenefit(normalized, subscription.plan, input.serviceId, input.now)
  if (!benefit.covered) return { ...benefit, subscriptionId: subscription.id }
  const incremented = await input.database.incrementVisit(subscription.id, normalized.visitsUsed)
  return incremented
    ? { covered: true, remainingVisits: benefit.remainingVisits - 1, subscriptionId: subscription.id }
    : { covered: false, remainingVisits: benefit.remainingVisits, subscriptionId: subscription.id }
}
