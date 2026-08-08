import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errors.js'
import { appointmentsRoutes } from './appointments.routes.js'

const originals = {
  findAppointments: prisma.appointment.findMany,
  groupAppointments: prisma.appointment.groupBy,
  findBarbershop: prisma.barbershop.findUnique,
  findHolidays: prisma.holiday.findMany,
  findMembership: prisma.membership.findUnique,
  findAbsences: prisma.barberAbsence.findMany,
  findBarberSchedule: prisma.barberSchedule.findMany,
}

const appointments = [
  {
    id: 'appointment-1',
    barbershopId: 'barbershop-1',
    userId: 'customer-1',
    barberId: 'barber-1',
    serviceId: 'service-1',
    scheduledAt: new Date('2026-08-03T12:00:00.000Z'),
    status: 'CONFIRMED',
    paymentStatus: 'APPROVED',
    paymentExpiresAt: null,
    paymentAmountCents: 5_000,
    commissionCents: 50,
    user: { id: 'customer-1', name: 'Marina Costa', email: null, role: 'CUSTOMER' },
    barber: { id: 'barber-1', name: 'Rafael Navalha', email: null, role: 'BARBER' },
    service: { id: 'service-1', name: 'Corte', duration: 30, priceCents: 5_000 },
  },
  {
    id: 'appointment-2',
    barbershopId: 'barbershop-1',
    userId: 'customer-2',
    barberId: 'barber-2',
    serviceId: 'service-1',
    scheduledAt: new Date('2026-08-03T13:00:00.000Z'),
    status: 'CANCELLED',
    paymentStatus: 'REFUNDED',
    paymentExpiresAt: null,
    paymentAmountCents: 5_000,
    commissionCents: 50,
    user: { id: 'customer-2', name: 'Pedro Lima', email: null, role: 'CUSTOMER' },
    barber: { id: 'barber-2', name: 'Caio Santos', email: null, role: 'BARBER' },
    service: { id: 'service-1', name: 'Corte', duration: 30, priceCents: 5_000 },
  },
]

let membershipRole = 'BARBER'
let userRole = 'BARBER'
let capturedAppointmentWhere: Record<string, unknown> | undefined
let noShowGroups: Array<{ userId: string; _count: { _all: number } }> = []

const startApp = async () => {
  const app = express()
  app.use((req, _res, next) => {
    req.user = { id: 'barber-1', role: userRole } as Express.User
    next()
  })
  app.use('/appointments', appointmentsRoutes)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  return { server, url: `http://127.0.0.1:${address.port}/appointments/calendar` }
}

describe('appointments calendar', () => {
  beforeEach(() => {
    membershipRole = 'BARBER'
    userRole = 'BARBER'
    capturedAppointmentWhere = undefined
    noShowGroups = []
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: async () => ({
      id: 'barbershop-1',
      timezone: 'America/Sao_Paulo',
      businessHours: Array.from({ length: 7 }, (_, weekday) => ({
        weekday, opensAt: '09:00', closesAt: '18:00', breakStartsAt: '12:00', breakEndsAt: '13:00', enabled: true,
      })),
    }) as never })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: async () => (
      userRole === 'CUSTOMER' ? null : { role: membershipRole }
    ) as never })
    Object.defineProperty(prisma.holiday, 'findMany', { configurable: true, value: async () => [] })
    Object.defineProperty(prisma.barberAbsence, 'findMany', { configurable: true, value: async () => [] })
    Object.defineProperty(prisma.barberSchedule, 'findMany', { configurable: true, value: async () => [] })
    Object.defineProperty(prisma.appointment, 'findMany', { configurable: true, value: async ({ where }: { where: Record<string, unknown> }) => {
      capturedAppointmentWhere = where
      return where.barberId ? appointments.filter((item) => item.barberId === where.barberId) : appointments
    } })
    Object.defineProperty(prisma.appointment, 'groupBy', { configurable: true, value: async () => noShowGroups })
  })

  afterEach(() => {
    Object.defineProperty(prisma.appointment, 'findMany', { configurable: true, value: originals.findAppointments })
    Object.defineProperty(prisma.appointment, 'groupBy', { configurable: true, value: originals.groupAppointments })
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: originals.findBarbershop })
    Object.defineProperty(prisma.holiday, 'findMany', { configurable: true, value: originals.findHolidays })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: originals.findMembership })
    Object.defineProperty(prisma.barberAbsence, 'findMany', { configurable: true, value: originals.findAbsences })
    Object.defineProperty(prisma.barberSchedule, 'findMany', { configurable: true, value: originals.findBarberSchedule })
  })

  it('limits a BARBER membership to its own appointments', async () => {
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}?from=2026-08-03&to=2026-08-03`)

      assert.equal(response.status, 200)
      assert.equal(capturedAppointmentWhere?.barberId, 'barber-1')
      const body = await response.json() as { days: Array<{ appointments: Array<{ barberId: string }> }> }
      assert.deepEqual(body.days[0]?.appointments.map((item) => item.barberId), ['barber-1'])
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('returns every barber appointment to an OWNER membership, including cancelled ones', async () => {
    membershipRole = 'OWNER'
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}?from=2026-08-03&to=2026-08-03`)

      assert.equal(response.status, 200)
      assert.equal(capturedAppointmentWhere?.barberId, undefined)
      const body = await response.json() as { days: Array<{ appointments: Array<{ barberId: string; status: string }> }> }
      assert.deepEqual(body.days[0]?.appointments.map((item) => [item.barberId, item.status]), [
        ['barber-1', 'CONFIRMED'],
        ['barber-2', 'CANCELLED'],
      ])
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('rejects ranges longer than 62 calendar days', async () => {
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}?from=2026-01-01&to=2026-03-04`)

      assert.equal(response.status, 400)
      assert.equal(capturedAppointmentWhere, undefined)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('exposes NO_SHOW and the customer count scoped to the barbershop', async () => {
    membershipRole = 'OWNER'
    noShowGroups = [{ userId: 'customer-1', _count: { _all: 2 } }]
    appointments.push({ ...appointments[0]!, id: 'appointment-3', status: 'NO_SHOW' })
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}?from=2026-08-03&to=2026-08-03`)
      assert.equal(response.status, 200)
      const body = await response.json() as { days: Array<{ appointments: Array<{ status: string; user: { noShowCount: number } }> }> }
      const noShow = body.days[0]?.appointments.find((item) => item.status === 'NO_SHOW')
      assert.equal(noShow?.user.noShowCount, 2)
    } finally {
      appointments.pop()
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('rejects customers without a membership', async () => {
    userRole = 'CUSTOMER'
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}?from=2026-08-03&to=2026-08-03`)

      assert.equal(response.status, 403)
      assert.equal(capturedAppointmentWhere, undefined)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })
})
