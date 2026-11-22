import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import { prisma } from '../lib/prisma.js'
import { processRecurringBookings } from './recurring-bookings.service.js'

type Model = Record<string, unknown>
const patched: Array<[Model, string, unknown]> = []
const patch = (target: object, key: string, value: unknown) => {
  patched.push([target as Model, key, (target as Model)[key]])
  Object.defineProperty(target, key, { configurable: true, value })
}
afterEach(() => {
  for (const [target, key, value] of patched.splice(0).reverse()) Object.defineProperty(target, key, { configurable: true, value })
})

const now = new Date('2026-08-09T12:00:00.000Z')
const booking = {
  id: 'rb-1', barbershopId: 'shop-1', userId: 'user-1', barberId: 'barber-1', weekday: 1, time: '10:00', serviceIds: ['svc-1'],
  subscription: {
    id: 'sub-1', status: 'ACTIVE', visitsUsed: 0,
    currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'), currentPeriodEnd: new Date('2026-08-31T00:00:00.000Z'),
    plan: { includedVisits: 4, intervalDays: 30, serviceIds: ['svc-1'] },
  },
  barbershop: {
    timezone: 'America/Sao_Paulo', depositType: 'NONE', depositValue: 0, commissionBps: 0, mercadoPagoSellerId: null,
    businessHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensAt: '08:00', closesAt: '20:00', enabled: true })),
  },
  user: { email: null },
  barber: {},
}

const setup = (insertFails: boolean) => {
  const committed = { visits: 0, occurrences: 0 }
  const empty = async () => []
  patch(prisma.recurringBooking, 'findMany', async () => [booking])
  patch(prisma.recurringBookingOccurrence, 'findUnique', async () => null)
  patch(prisma.service, 'findMany', async () => [{ id: 'svc-1', name: 'Corte', duration: 30, priceCents: 5000 }])
  for (const model of [prisma.appointment, prisma.holiday, prisma.barberSchedule, prisma.barberAbsence]) patch(model, 'findMany', empty)
  patch(prisma.customerSubscription, 'updateMany', async () => { committed.visits += 1; return { count: 1 } })
  const createAppointment = async () => { if (insertFails) throw new Error('connection reset'); return { id: 'apt-1' } }
  patch(prisma.appointment, 'create', createAppointment)
  patch(prisma.recurringBookingOccurrence, 'create', async () => { committed.occurrences += 1; return {} })
  // Fake transaction: writes made through tx only count once the callback resolves.
  patch(prisma, '$transaction', async (fn: (tx: unknown) => Promise<unknown>) => {
    let visits = 0
    let occurrences = 0
    const tx = {
      customerSubscription: { updateMany: async () => { visits += 1; return { count: 1 } } },
      appointment: { create: createAppointment },
      recurringBookingOccurrence: { create: async () => { occurrences += 1; return {} } },
    }
    const result = await fn(tx)
    committed.visits += visits
    committed.occurrences += occurrences
    return result
  })
  return committed
}

test('a failed appointment insert does not consume an included visit (the next run would charge it again)', async () => {
  const committed = setup(true)
  await assert.rejects(processRecurringBookings(now), /connection reset/)
  assert.deepEqual(committed, { visits: 0, occurrences: 0 })
})

test('a successful run keeps the visit and the occurrence of each created slot', async () => {
  const committed = setup(false)
  assert.equal((await processRecurringBookings(now)).created, 4)
  assert.deepEqual(committed, { visits: 4, occurrences: 4 })
})
