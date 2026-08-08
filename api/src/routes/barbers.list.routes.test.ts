import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errors.js'
import { appointmentsRoutes } from './appointments.routes.js'
import { barbersRoutes } from './barbers.routes.js'

const ids = {
  barber: '00000000-0000-4000-8000-000000000001',
  customer: '00000000-0000-4000-8000-000000000002',
  cut: '00000000-0000-4000-8000-000000000003',
  beard: '00000000-0000-4000-8000-000000000004',
}

const shop = {
  id: 'barbershop-1',
  timezone: 'America/Sao_Paulo',
  businessHours: [
    { weekday: 3, opensAt: '09:00', closesAt: '11:00', enabled: true },
    { weekday: 4, opensAt: '09:00', closesAt: '11:00', enabled: true },
  ],
}
const barber = { id: ids.barber, name: 'Rafael', email: 'rafael@example.com', role: 'BARBER' }
const services = [
  { id: ids.cut, barbershopId: shop.id, name: 'Corte', duration: 30, active: true },
  { id: ids.beard, barbershopId: shop.id, name: 'Barba', duration: 45, active: true },
]

const originals = {
  findBarbershop: prisma.barbershop.findUnique,
  findMembership: prisma.membership.findUnique,
  findUsers: prisma.user.findMany,
  findUser: prisma.user.findFirst,
  findServices: prisma.service.findMany,
  findService: prisma.service.findUnique,
  findAppointments: prisma.appointment.findMany,
  findHolidays: prisma.holiday.findMany,
  findSchedules: prisma.barberSchedule.findMany,
  findAbsences: prisma.barberAbsence.findMany,
}

let schedules: Array<{ barberId: string; weekday: number; startsAt: string; endsAt: string; enabled: boolean }>
let absences: Array<{ barberId: string; startsAt: Date; endsAt: Date; reason: string }>
let appointments: Array<{ id: string; barberId: string; scheduledAt: Date; service: { duration: number } }>

async function startApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: ids.customer, role: 'CUSTOMER' } as Express.User
    next()
  })
  app.use('/barbers', barbersRoutes)
  app.use('/appointments', appointmentsRoutes)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  return { server, url: `http://127.0.0.1:${address.port}` }
}

describe('dated barber list', () => {
  beforeEach(() => {
    schedules = []
    absences = []
    appointments = []
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: async () => shop as never })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: async () => ({ role: 'CUSTOMER' }) })
    Object.defineProperty(prisma.user, 'findMany', { configurable: true, value: async () => [barber] as never })
    Object.defineProperty(prisma.user, 'findFirst', { configurable: true, value: async () => barber as never })
    Object.defineProperty(prisma.service, 'findMany', {
      configurable: true,
      value: async ({ where }: { where: { id: { in: string[] } } }) => services.filter((service) => where.id.in.includes(service.id)) as never,
    })
    Object.defineProperty(prisma.service, 'findUnique', { configurable: true, value: async () => services[0] as never })
    Object.defineProperty(prisma.appointment, 'findMany', { configurable: true, value: async () => appointments as never })
    Object.defineProperty(prisma.holiday, 'findMany', { configurable: true, value: async () => [] })
    Object.defineProperty(prisma.barberSchedule, 'findMany', { configurable: true, value: async () => schedules as never })
    Object.defineProperty(prisma.barberAbsence, 'findMany', { configurable: true, value: async () => absences as never })
  })

  afterEach(() => {
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: originals.findBarbershop })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: originals.findMembership })
    Object.defineProperty(prisma.user, 'findMany', { configurable: true, value: originals.findUsers })
    Object.defineProperty(prisma.user, 'findFirst', { configurable: true, value: originals.findUser })
    Object.defineProperty(prisma.service, 'findMany', { configurable: true, value: originals.findServices })
    Object.defineProperty(prisma.service, 'findUnique', { configurable: true, value: originals.findService })
    Object.defineProperty(prisma.appointment, 'findMany', { configurable: true, value: originals.findAppointments })
    Object.defineProperty(prisma.holiday, 'findMany', { configurable: true, value: originals.findHolidays })
    Object.defineProperty(prisma.barberSchedule, 'findMany', { configurable: true, value: originals.findSchedules })
    Object.defineProperty(prisma.barberAbsence, 'findMany', { configurable: true, value: originals.findAbsences })
  })

  it('preserves the legacy response without date', async () => {
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}/barbers`)
      assert.deepEqual(await response.json(), [{ ...barber, specialty: 'Cortes e barba' }])
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('marks a barber outside the schedule and reports the next working date', async () => {
    schedules = [{ barberId: ids.barber, weekday: 3, startsAt: '09:00', endsAt: '11:00', enabled: true }]
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}/barbers?date=2099-08-06&serviceIds=${ids.cut}`)
      const [result] = await response.json() as Array<Record<string, unknown>>
      assert.deepEqual(result, {
        ...barber,
        specialty: 'Cortes e barba',
        available: false,
        unavailableReason: 'fora da escala',
        slotCount: 0,
        firstAvailableTime: null,
        nextAvailableDate: '2099-08-12',
      })
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('distinguishes a full-day absence from a partial absence', async () => {
    absences = [{ barberId: ids.barber, startsAt: new Date('2099-08-05T12:00:00.000Z'), endsAt: new Date('2099-08-05T14:00:00.000Z'), reason: 'Consulta' }]
    const { server, url } = await startApp()
    try {
      const full = await fetch(`${url}/barbers?date=2099-08-05&serviceIds=${ids.cut}`)
      assert.deepEqual((await full.json() as Array<Record<string, unknown>>)[0], {
        ...barber, specialty: 'Cortes e barba', available: false, unavailableReason: 'ausência',
        slotCount: 0, firstAvailableTime: null, nextAvailableDate: '2099-08-06',
      })

      absences[0]!.endsAt = new Date('2099-08-05T12:30:00.000Z')
      const partial = await fetch(`${url}/barbers?date=2099-08-05&serviceIds=${ids.cut}`)
      const [result] = await partial.json() as Array<Record<string, unknown>>
      assert.equal(result!.available, true)
      assert.equal(result!.slotCount, 5)
      assert.equal(result!.firstAvailableTime, '09:30')
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('marks a barber with every slot occupied as agenda cheia', async () => {
    appointments = ['12:00', '12:30', '13:00', '13:30'].map((time, index) => ({
      id: `appointment-${index}`,
      barberId: ids.barber,
      scheduledAt: new Date(`2099-08-05T${time}:00.000Z`),
      service: { duration: 30 },
    }))
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}/barbers?date=2099-08-05&serviceIds=${ids.cut}`)
      const [result] = await response.json() as Array<Record<string, unknown>>
      assert.equal(result!.available, false)
      assert.equal(result!.unavailableReason, 'agenda cheia')
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('uses the summed duration of serviceIds', async () => {
    const { server, url } = await startApp()
    try {
      const single = await fetch(`${url}/barbers?date=2099-08-05&serviceIds=${ids.cut}`)
      const combined = await fetch(`${url}/barbers?date=2099-08-05&serviceIds=${ids.cut},${ids.beard}`)
      assert.equal((await single.json() as Array<{ slotCount: number }>)[0]?.slotCount, 7)
      assert.equal((await combined.json() as Array<{ slotCount: number }>)[0]?.slotCount, 4)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('returns exactly the same slots summary as the slot selector', async () => {
    const { server, url } = await startApp()
    try {
      const listResponse = await fetch(`${url}/barbers?date=2099-08-05&serviceIds=${ids.cut}`)
      const availabilityResponse = await fetch(`${url}/appointments/availability?barberId=${ids.barber}&serviceId=${ids.cut}&date=2099-08-05`)
      const [listed] = await listResponse.json() as Array<{ slotCount: number; firstAvailableTime: string }>
      const availability = await availabilityResponse.json() as { slots: Array<{ label: string }> }
      assert.equal(listed!.slotCount, availability.slots.length)
      assert.equal(listed!.firstAvailableTime, availability.slots[0]?.label)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })
})
