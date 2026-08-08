import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errors.js'
import { appointmentsFitNowRoutes, walkInQueueRoutes } from './walk-in-queue.routes.js'

const ids = {
  queue: '00000000-0000-4000-8000-000000000011',
  barber: '00000000-0000-4000-8000-000000000012',
  customer: '00000000-0000-4000-8000-000000000013',
  service: '00000000-0000-4000-8000-000000000014',
  appointment: '00000000-0000-4000-8000-000000000015',
}

const originals = {
  findBarbershop: prisma.barbershop.findUnique,
  findMembership: prisma.membership.findUnique,
  findMemberships: prisma.membership.findMany,
  findUsers: prisma.user.findMany,
  findUser: prisma.user.findUnique,
  findServices: prisma.service.findMany,
  findAppointments: prisma.appointment.findMany,
  createAppointment: prisma.appointment.create,
  findHolidays: prisma.holiday.findMany,
  findSchedules: prisma.barberSchedule.findMany,
  findAbsences: prisma.barberAbsence.findMany,
  findQueue: prisma.walkInQueue.findMany,
  findQueueEntry: prisma.walkInQueue.findFirst,
  updateQueue: prisma.walkInQueue.update,
  updateQueues: prisma.walkInQueue.updateMany,
  findUniqueQueue: prisma.walkInQueue.findUnique,
  transaction: prisma.$transaction,
}

const barber = { id: ids.barber, name: 'Rafael', email: null, role: 'BARBER' }
const customer = { id: ids.customer, name: 'Marina', email: null, role: 'CUSTOMER' }
const service = { id: ids.service, barbershopId: 'shop-1', name: 'Corte', duration: 30, priceCents: 5_000, active: true }
const barbershop = {
  id: 'shop-1', slug: 'barbearia-central', name: 'Central', timezone: 'America/Sao_Paulo', subscriptionStatus: 'ACTIVE',
  businessHours: Array.from({ length: 7 }, (_, weekday) => ({
    weekday, opensAt: '00:00', closesAt: '23:59', breakStartsAt: null, breakEndsAt: null, enabled: true,
  })),
}

const queueEntry = () => ({
  id: ids.queue,
  barbershopId: barbershop.id,
  userId: ids.customer,
  guestName: null,
  serviceIds: [ids.service],
  barberId: ids.barber,
  status: 'WAITING',
  arrivedAt: new Date(),
  calledAt: null,
  finishedAt: null,
  estimatedMinutes: 0,
  createdAt: new Date(),
  user: { id: ids.customer, name: customer.name },
  barber: { id: ids.barber, name: barber.name },
})

let createdData: Record<string, unknown> | null
let queueUpdateData: Record<string, unknown> | null
let scheduledAppointments: Array<Record<string, unknown>>

async function startApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { req.user = barber as Express.User; next() })
  app.use('/appointments', appointmentsFitNowRoutes)
  app.use('/walk-in-queue', walkInQueueRoutes)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  return { server, url: `http://127.0.0.1:${address.port}/walk-in-queue` }
}

describe('walk-in queue routes', () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-08-05T13:00:00.000Z') })
    createdData = null
    queueUpdateData = null
    scheduledAppointments = []
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: async () => barbershop })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: async () => ({ role: 'BARBER' }) })
    Object.defineProperty(prisma.membership, 'findMany', { configurable: true, value: async () => [] })
    Object.defineProperty(prisma.user, 'findMany', { configurable: true, value: async () => [barber] })
    Object.defineProperty(prisma.user, 'findUnique', { configurable: true, value: async () => customer })
    Object.defineProperty(prisma.service, 'findMany', { configurable: true, value: async () => [service] })
    Object.defineProperty(prisma.appointment, 'findMany', { configurable: true, value: async () => scheduledAppointments })
    Object.defineProperty(prisma.appointment, 'create', { configurable: true, value: async ({ data }: { data: Record<string, unknown> }) => {
      createdData = data
      return { id: ids.appointment, ...data, user: customer, barber, service }
    } })
    Object.defineProperty(prisma.holiday, 'findMany', { configurable: true, value: async () => [] })
    Object.defineProperty(prisma.barberSchedule, 'findMany', { configurable: true, value: async () => [] })
    Object.defineProperty(prisma.barberAbsence, 'findMany', { configurable: true, value: async () => [] })
    Object.defineProperty(prisma.walkInQueue, 'findMany', { configurable: true, value: async () => [queueEntry()] })
    Object.defineProperty(prisma.walkInQueue, 'findFirst', { configurable: true, value: async () => queueEntry() })
    Object.defineProperty(prisma.walkInQueue, 'update', { configurable: true, value: async ({ data }: { data: Record<string, unknown> }) => {
      queueUpdateData = data
      return { ...queueEntry(), ...data }
    } })
    Object.defineProperty(prisma.walkInQueue, 'updateMany', { configurable: true, value: async () => ({ count: 1 }) })
    Object.defineProperty(prisma.walkInQueue, 'findUnique', { configurable: true, value: async () => ({ ...queueEntry(), status: 'GAVE_UP' }) })
    Object.defineProperty(prisma, '$transaction', { configurable: true, value: async (callback: (tx: typeof prisma) => unknown) => callback(prisma) })
  })

  afterEach(() => {
    mock.timers.reset()
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: originals.findBarbershop })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: originals.findMembership })
    Object.defineProperty(prisma.membership, 'findMany', { configurable: true, value: originals.findMemberships })
    Object.defineProperty(prisma.user, 'findMany', { configurable: true, value: originals.findUsers })
    Object.defineProperty(prisma.user, 'findUnique', { configurable: true, value: originals.findUser })
    Object.defineProperty(prisma.service, 'findMany', { configurable: true, value: originals.findServices })
    Object.defineProperty(prisma.appointment, 'findMany', { configurable: true, value: originals.findAppointments })
    Object.defineProperty(prisma.appointment, 'create', { configurable: true, value: originals.createAppointment })
    Object.defineProperty(prisma.holiday, 'findMany', { configurable: true, value: originals.findHolidays })
    Object.defineProperty(prisma.barberSchedule, 'findMany', { configurable: true, value: originals.findSchedules })
    Object.defineProperty(prisma.barberAbsence, 'findMany', { configurable: true, value: originals.findAbsences })
    Object.defineProperty(prisma.walkInQueue, 'findMany', { configurable: true, value: originals.findQueue })
    Object.defineProperty(prisma.walkInQueue, 'findFirst', { configurable: true, value: originals.findQueueEntry })
    Object.defineProperty(prisma.walkInQueue, 'update', { configurable: true, value: originals.updateQueue })
    Object.defineProperty(prisma.walkInQueue, 'updateMany', { configurable: true, value: originals.updateQueues })
    Object.defineProperty(prisma.walkInQueue, 'findUnique', { configurable: true, value: originals.findUniqueQueue })
    Object.defineProperty(prisma, '$transaction', { configurable: true, value: originals.transaction })
  })

  it('calls the first customer through the validated normal appointment fields', async () => {
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}/${ids.queue}/call`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ barberId: ids.barber }),
      })
      assert.equal(response.status, 200)
      assert.equal(createdData?.status, 'CONFIRMED')
      assert.equal(createdData?.paymentStatus, 'NOT_REQUIRED')
      assert.equal(createdData?.walkInQueueId, ids.queue)
      assert.equal(queueUpdateData?.status, 'IN_SERVICE')
    } finally { server.close() }
  })

  it('reports the running service and skips the next booked appointment in fit-now', async () => {
    scheduledAppointments = [
      { id: 'current', barberId: ids.barber, status: 'CONFIRMED', scheduledAt: new Date('2026-08-05T12:50:00.000Z'), service },
      { id: 'booked', barberId: ids.barber, status: 'CONFIRMED', scheduledAt: new Date('2026-08-05T13:45:00.000Z'), service },
    ]
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url.replace('/walk-in-queue', '/appointments')}/fit-now?serviceIds=${ids.service}`)
      assert.equal(response.status, 200)
      const body = await response.json() as { barbers: Array<{ fitsNow: boolean; currentServiceMinutesLeft: number; nextAvailableAt: string }> }
      assert.equal(body.barbers[0]?.fitsNow, false)
      assert.equal(body.barbers[0]?.currentServiceMinutesLeft, 20)
      assert.equal(body.barbers[0]?.nextAvailableAt, '2026-08-05T14:15:00.000Z')
    } finally { server.close() }
  })

  it('registers give-up and removes the customer from WAITING', async () => {
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}/${ids.queue}/give-up`, { method: 'POST' })
      assert.equal(response.status, 200)
      assert.equal((await response.json() as { status: string }).status, 'GAVE_UP')
    } finally { server.close() }
  })
})
