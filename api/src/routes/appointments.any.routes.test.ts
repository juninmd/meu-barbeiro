import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errors.js'
import { appointmentsRoutes } from './appointments.routes.js'

const ids = {
  shop: '11111111-1111-4111-8111-111111111111', customer: '22222222-2222-4222-8222-222222222222',
  service: '33333333-3333-4333-8333-333333333333', barber1: '44444444-4444-4444-8444-444444444444',
  barber2: '55555555-5555-4555-8555-555555555555',
}
const service = { id: ids.service, name: 'Corte', duration: 30, priceCents: 5_000, active: true }
const shop = {
  id: ids.shop, timezone: 'America/Sao_Paulo', subscriptionStatus: 'ACTIVE', depositType: 'NONE', depositValue: 0,
  commissionBps: 100, mercadoPagoSellerId: null,
  businessHours: Array.from({ length: 7 }, (_, weekday) => ({
    weekday, opensAt: '09:00', closesAt: '18:00', breakStartsAt: '12:00', breakEndsAt: '13:00', enabled: weekday === 3,
  })),
}
const originals = {
  findBarbershop: prisma.barbershop.findUnique, findService: prisma.service.findFirst,
  findUniqueService: prisma.service.findUnique, findUsers: prisma.user.findMany, findUser: prisma.user.findFirst,
  findAppointments: prisma.appointment.findMany, findLastAppointment: prisma.appointment.findFirst,
  createAppointment: prisma.appointment.create,
  findHolidays: prisma.holiday.findMany, findSchedules: prisma.barberSchedule.findMany,
  findAbsences: prisma.barberAbsence.findMany, findMembership: prisma.membership.findUnique,
  findMemberships: prisma.membership.findMany,
  findCustomerSubscription: prisma.customerSubscription.findFirst,
}
let holidays: Array<{ date: Date; description: string }> = []
let appointments: Array<Record<string, unknown>> = []
let createdBarberId: string | undefined

async function startApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: ids.customer, role: 'CUSTOMER', email: null } as Express.User
    next()
  })
  app.use('/appointments', appointmentsRoutes)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  return { server, url: `http://127.0.0.1:${address.port}/appointments` }
}

describe('any barber appointments', () => {
  beforeEach(() => {
    holidays = []
    appointments = []
    createdBarberId = undefined
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: async () => shop as never })
    Object.defineProperty(prisma.service, 'findFirst', { configurable: true, value: async () => service as never })
    Object.defineProperty(prisma.service, 'findUnique', { configurable: true, value: async () => service as never })
    Object.defineProperty(prisma.user, 'findMany', { configurable: true, value: async () => [
      { id: ids.barber1, name: 'Rafael' }, { id: ids.barber2, name: 'Caio' },
    ] as never })
    Object.defineProperty(prisma.user, 'findFirst', { configurable: true, value: async ({ where }: { where: { id: string } }) => ({
      id: where.id, name: where.id === ids.barber1 ? 'Rafael' : 'Caio', email: null, role: 'BARBER',
    }) as never })
    Object.defineProperty(prisma.appointment, 'findMany', { configurable: true, value: async ({ where }: { where: { barberId?: string } }) => (
      where.barberId ? appointments.filter((item) => item.barberId === where.barberId) : appointments
    ) as never })
    Object.defineProperty(prisma.holiday, 'findMany', { configurable: true, value: async () => holidays })
    Object.defineProperty(prisma.barberSchedule, 'findMany', { configurable: true, value: async () => [{
      barberId: ids.barber2, weekday: 3, startsAt: '09:00', endsAt: '12:00', enabled: true,
    }] })
    Object.defineProperty(prisma.barberAbsence, 'findMany', { configurable: true, value: async () => [{
      barberId: ids.barber2, startsAt: new Date('2099-08-05T14:00:00.000Z'), endsAt: new Date('2099-08-05T14:30:00.000Z'),
    }] })
    Object.defineProperty(prisma.appointment, 'create', { configurable: true, value: async ({ data }: { data: { barberId: string } }) => {
      createdBarberId = data.barberId
      return {
        id: 'appointment-new', userId: ids.customer, serviceId: ids.service, scheduledAt: new Date('2099-08-05T13:00:00.000Z'),
        status: 'PENDING', paymentStatus: 'NOT_REQUIRED', paymentExpiresAt: null, paymentAmountCents: 0, commissionCents: 0,
        barberId: data.barberId, user: { id: ids.customer, name: 'Marina', email: null, role: 'CUSTOMER' },
        barber: { id: data.barberId, name: 'Caio', email: null, role: 'BARBER' }, service, reminders: [],
      }
    } })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: async () => ({ role: 'BARBER' }) as never })
    Object.defineProperty(prisma.membership, 'findMany', { configurable: true, value: async () => [] })
    Object.defineProperty(prisma.customerSubscription, 'findFirst', { configurable: true, value: async () => null })
  })

  afterEach(() => {
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: originals.findBarbershop })
    Object.defineProperty(prisma.service, 'findFirst', { configurable: true, value: originals.findService })
    Object.defineProperty(prisma.service, 'findUnique', { configurable: true, value: originals.findUniqueService })
    Object.defineProperty(prisma.user, 'findMany', { configurable: true, value: originals.findUsers })
    Object.defineProperty(prisma.user, 'findFirst', { configurable: true, value: originals.findUser })
    Object.defineProperty(prisma.appointment, 'findMany', { configurable: true, value: originals.findAppointments })
    Object.defineProperty(prisma.appointment, 'findFirst', { configurable: true, value: originals.findLastAppointment })
    Object.defineProperty(prisma.appointment, 'create', { configurable: true, value: originals.createAppointment })
    Object.defineProperty(prisma.holiday, 'findMany', { configurable: true, value: originals.findHolidays })
    Object.defineProperty(prisma.barberSchedule, 'findMany', { configurable: true, value: originals.findSchedules })
    Object.defineProperty(prisma.barberAbsence, 'findMany', { configurable: true, value: originals.findAbsences })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: originals.findMembership })
    Object.defineProperty(prisma.membership, 'findMany', { configurable: true, value: originals.findMemberships })
    Object.defineProperty(prisma.customerSubscription, 'findFirst', { configurable: true, value: originals.findCustomerSubscription })
  })

  it('unites only real slots and reports the barbers available in each one', async () => {
    appointments = [{
      id: 'busy', barberId: ids.barber1, scheduledAt: new Date('2099-08-05T13:00:00.000Z'), status: 'CONFIRMED',
      paymentStatus: 'APPROVED', paymentExpiresAt: null, service,
    }]
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}/availability?barberId=any&serviceId=${ids.service}&date=2099-08-05`)
      assert.equal(response.status, 200)
      const body = await response.json() as { slots: Array<{ label: string; barbers: Array<{ id: string }> }> }
      assert.deepEqual(body.slots.find((slot) => slot.label === '10:00')?.barbers.map((barber) => barber.id), [ids.barber2])
      assert.deepEqual(body.slots.find((slot) => slot.label === '11:00')?.barbers.map((barber) => barber.id), [ids.barber1])
      assert.equal(body.slots.some((slot) => slot.label === '12:00'), false)
      assert.deepEqual(body.slots.find((slot) => slot.label === '13:00')?.barbers.map((barber) => barber.id), [ids.barber1])
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('returns no slots on a barbershop holiday', async () => {
    holidays = [{ date: new Date('2099-08-05T00:00:00.000Z'), description: 'Feriado' }]
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}/availability?barberId=any&serviceId=${ids.service}&date=2099-08-05`)
      const body = await response.json() as { open: boolean; slots: unknown[] }
      assert.equal(body.open, false)
      assert.deepEqual(body.slots, [])
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('assigns the booking to the available barber with fewer appointments that day', async () => {
    appointments = [{
      id: 'done', barberId: ids.barber1, scheduledAt: new Date('2099-08-05T12:00:00.000Z'), status: 'DONE',
      paymentStatus: 'APPROVED', paymentExpiresAt: null, service,
    }]
    const { server, url } = await startApp()
    try {
      const response = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ barberId: 'any', serviceId: ids.service, scheduledAt: '2099-08-05T13:00:00.000Z' }),
      })
      assert.equal(response.status, 201)
      assert.equal(createdBarberId, ids.barber2)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('returns a safe fallback when the last completed service is inactive', async () => {
    Object.defineProperty(prisma.appointment, 'findFirst', { configurable: true, value: async () => ({
      barberId: ids.barber1, service: { ...service, active: false }, barber: { id: ids.barber1, name: 'Rafael' },
    }) as never })
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}/last`)
      assert.equal(response.status, 200)
      assert.equal((await response.json() as { repeatable: boolean }).repeatable, false)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })
})
