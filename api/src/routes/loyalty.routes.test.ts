import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errors.js'
import { appointmentsRoutes } from './appointments.routes.js'
import { loyaltyRoutes } from './loyalty.routes.js'

const ids = {
  appointment: '00000000-0000-4000-8000-000000000001',
  barber: '00000000-0000-4000-8000-000000000002',
  customer: '00000000-0000-4000-8000-000000000003',
  service: '00000000-0000-4000-8000-000000000004',
}

const originals = {
  findBarbershop: prisma.barbershop.findUnique,
  findMembership: prisma.membership.findUnique,
  findAppointment: prisma.appointment.findFirst,
  updateAppointment: prisma.appointment.update,
  transaction: prisma.$transaction,
}

const barbershop = {
  id: 'shop-1', timezone: 'America/Sao_Paulo', subscriptionStatus: 'ACTIVE', businessHours: [],
}
let membershipRole = 'BARBER'

const appointment = (status: string) => ({
  id: ids.appointment, barbershopId: barbershop.id, userId: ids.customer, barberId: ids.barber, serviceId: ids.service,
  scheduledAt: new Date('2026-08-08T15:00:00.000Z'), status, paymentStatus: 'NOT_REQUIRED', paymentExpiresAt: null,
  paymentAmountCents: 0, commissionCents: 0, mercadoPagoPaymentId: null, barbershop,
  user: { id: ids.customer, name: 'Marina', email: null, phone: null, role: 'CUSTOMER' },
  barber: { id: ids.barber, name: 'Rafael', email: null, role: 'BARBER' },
  service: { id: ids.service, name: 'Corte', duration: 30, priceCents: 5_000 }, reminders: [],
})

async function startApp(path: string, routes: express.Router) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { req.user = { id: ids.barber, role: 'BARBER' } as Express.User; next() })
  app.use(path, routes)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  return { server, url: `http://127.0.0.1:${address.port}${path}` }
}

describe('loyalty', () => {
  beforeEach(() => {
    membershipRole = 'BARBER'
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: async () => barbershop as never })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: async () => ({ role: membershipRole }) as never })
  })

  afterEach(() => {
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: originals.findBarbershop })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: originals.findMembership })
    Object.defineProperty(prisma.appointment, 'findFirst', { configurable: true, value: originals.findAppointment })
    Object.defineProperty(prisma.appointment, 'update', { configurable: true, value: originals.updateAppointment })
    Object.defineProperty(prisma, '$transaction', { configurable: true, value: originals.transaction })
  })

  it('creates one stamp on DONE and removes it when DONE is reverted', async () => {
    let currentStatus = 'CONFIRMED'
    const stamps = new Set<string>()
    Object.defineProperty(prisma.appointment, 'findFirst', { configurable: true, value: async () => appointment(currentStatus) as never })
    Object.defineProperty(prisma, '$transaction', { configurable: true, value: async (operation: (tx: object) => unknown) => operation({
      appointment: { update: async ({ data }: { data: { status: string } }) => { currentStatus = data.status; return appointment(currentStatus) } },
      loyaltyProgram: { findUnique: async () => ({ enabled: true }) },
      loyaltyStamp: {
        upsert: async ({ where }: { where: { appointmentId: string } }) => { stamps.add(where.appointmentId) },
        deleteMany: async ({ where }: { where: { appointmentId: string } }) => ({ count: stamps.delete(where.appointmentId) ? 1 : 0 }),
      },
    }) })
    const { server, url } = await startApp('/appointments', appointmentsRoutes)
    try {
      const done = await fetch(`${url}/${ids.appointment}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'DONE' }),
      })
      assert.equal(done.status, 200)
      assert.deepEqual([...stamps], [ids.appointment])

      currentStatus = 'CONFIRMED'
      await fetch(`${url}/${ids.appointment}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'DONE' }),
      })
      assert.equal(stamps.size, 1)

      currentStatus = 'DONE'
      membershipRole = 'OWNER'
      const reverted = await fetch(`${url}/${ids.appointment}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'CONFIRMED' }),
      })
      assert.equal(reverted.status, 200)
      assert.equal(stamps.size, 0)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('refuses redemption without enough stamps and consumes nothing', async () => {
    let updates = 0
    Object.defineProperty(prisma, '$transaction', { configurable: true, value: async (operation: (tx: object) => unknown) => operation({
      loyaltyProgram: { findUnique: async () => ({ enabled: true, requiredVisits: 10 }) },
      loyaltyStamp: {
        findMany: async () => Array.from({ length: 9 }, (_, index) => ({ id: `stamp-${index}` })),
        updateMany: async () => { updates += 1; return { count: 9 } },
      },
    }) })
    const { server, url } = await startApp('/loyalty', loyaltyRoutes)
    try {
      const response = await fetch(`${url}/redeem`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: ids.customer }),
      })
      assert.equal(response.status, 409)
      assert.equal(updates, 0)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('does not create a stamp for cancellation or no-show', async () => {
    let transactionCalls = 0
    let status = 'CONFIRMED'
    Object.defineProperty(prisma.appointment, 'findFirst', { configurable: true, value: async () => appointment(status) as never })
    Object.defineProperty(prisma.appointment, 'update', { configurable: true, value: async ({ data }: { data: { status: string } }) => {
      status = data.status
      return appointment(status)
    } })
    Object.defineProperty(prisma, '$transaction', { configurable: true, value: async () => { transactionCalls += 1 } })
    const { server, url } = await startApp('/appointments', appointmentsRoutes)
    try {
      const cancelled = await fetch(`${url}/${ids.appointment}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'CANCELLED' }),
      })
      assert.equal(cancelled.status, 200)
      status = 'CONFIRMED'
      const noShow = await fetch(`${url}/${ids.appointment}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'NO_SHOW' }),
      })
      assert.equal(noShow.status, 200)
      assert.equal(transactionCalls, 0)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })
})
