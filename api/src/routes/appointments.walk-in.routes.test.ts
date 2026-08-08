import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errors.js'
import { appointmentsRoutes } from './appointments.routes.js'

const ids = {
  appointment: '00000000-0000-4000-8000-000000000001',
  barber: '00000000-0000-4000-8000-000000000002',
  otherBarber: '00000000-0000-4000-8000-000000000003',
  customer: '00000000-0000-4000-8000-000000000004',
  service: '00000000-0000-4000-8000-000000000005',
}

const originals = {
  findBarbershop: prisma.barbershop.findUnique,
  findMembership: prisma.membership.findUnique,
  findMemberships: prisma.membership.findMany,
  findService: prisma.service.findUnique,
  findUser: prisma.user.findFirst,
  findUserByPhone: prisma.user.findUnique,
  createUser: prisma.user.create,
  findAppointments: prisma.appointment.findMany,
  findAppointment: prisma.appointment.findFirst,
  createAppointment: prisma.appointment.create,
  updateAppointment: prisma.appointment.update,
  findHolidays: prisma.holiday.findMany,
  findAbsences: prisma.barberAbsence.findMany,
  findBarberSchedule: prisma.barberSchedule.findMany,
}

const service = { id: ids.service, name: 'Corte', duration: 30, priceCents: 5_000 }
const barber = { id: ids.barber, name: 'Rafael', email: null, role: 'BARBER' }
const customer = { id: ids.customer, name: 'Marina', email: null, googleId: null, phone: '11999999999', role: 'CUSTOMER' }
const barbershop = {
  id: 'barbershop-1',
  slug: 'barbearia-central',
  timezone: 'America/Sao_Paulo',
  subscriptionStatus: 'ACTIVE',
  businessHours: Array.from({ length: 7 }, (_, weekday) => ({
    weekday, opensAt: '09:00', closesAt: '18:00', breakStartsAt: '12:00', breakEndsAt: '13:00', enabled: true,
  })),
}

let sessionRole = 'BARBER'
let membershipRole = 'BARBER'
let holidays: Array<{ date: Date; description: string }> = []
let scheduled: Array<Record<string, unknown>> = []
let createdUsers = 0
let updatedData: Record<string, unknown> | undefined

const publicRecord = (overrides: Record<string, unknown> = {}) => ({
  id: ids.appointment,
  barbershopId: barbershop.id,
  userId: ids.customer,
  barberId: ids.barber,
  serviceId: ids.service,
  scheduledAt: new Date('2099-08-05T13:00:00.000Z'),
  status: 'CONFIRMED',
  paymentStatus: 'NOT_REQUIRED',
  paymentExpiresAt: null,
  paymentAmountCents: 0,
  commissionCents: 0,
  mercadoPagoPaymentId: null,
  user: customer,
  barber,
  service,
  ...overrides,
})

async function startApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: ids.barber, role: sessionRole } as Express.User
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

describe('walk-in appointments and no-show', () => {
  beforeEach(() => {
    sessionRole = 'BARBER'
    membershipRole = 'BARBER'
    holidays = []
    scheduled = []
    createdUsers = 0
    updatedData = undefined
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: async () => barbershop })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: async () => ({ role: membershipRole }) })
    Object.defineProperty(prisma.membership, 'findMany', { configurable: true, value: async () => [] })
    Object.defineProperty(prisma.service, 'findUnique', { configurable: true, value: async () => service })
    Object.defineProperty(prisma.user, 'findFirst', { configurable: true, value: async ({ where }: { where: { id?: string } }) => (
      where.id === ids.otherBarber ? { ...barber, id: ids.otherBarber } : where.id === ids.customer ? customer : barber
    ) })
    Object.defineProperty(prisma.user, 'findUnique', { configurable: true, value: async () => customer })
    Object.defineProperty(prisma.user, 'create', { configurable: true, value: async () => { createdUsers += 1; return customer } })
    Object.defineProperty(prisma.appointment, 'findMany', { configurable: true, value: async () => scheduled })
    Object.defineProperty(prisma.appointment, 'findFirst', { configurable: true, value: async () => publicRecord({
      paymentStatus: 'APPROVED', paymentAmountCents: 2_000, mercadoPagoPaymentId: 'payment-1', barbershop,
    }) })
    Object.defineProperty(prisma.appointment, 'create', { configurable: true, value: async ({ data }: { data: Record<string, unknown> }) => publicRecord(data) })
    Object.defineProperty(prisma.appointment, 'update', { configurable: true, value: async ({ data }: { data: Record<string, unknown> }) => {
      updatedData = data
      return publicRecord({ paymentStatus: 'APPROVED', paymentAmountCents: 2_000, status: data.status ?? 'CONFIRMED' })
    } })
    Object.defineProperty(prisma.holiday, 'findMany', { configurable: true, value: async () => holidays })
    Object.defineProperty(prisma.barberAbsence, 'findMany', { configurable: true, value: async () => [] })
    Object.defineProperty(prisma.barberSchedule, 'findMany', { configurable: true, value: async () => [] })
  })

  afterEach(() => {
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: originals.findBarbershop })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: originals.findMembership })
    Object.defineProperty(prisma.membership, 'findMany', { configurable: true, value: originals.findMemberships })
    Object.defineProperty(prisma.service, 'findUnique', { configurable: true, value: originals.findService })
    Object.defineProperty(prisma.user, 'findFirst', { configurable: true, value: originals.findUser })
    Object.defineProperty(prisma.user, 'findUnique', { configurable: true, value: originals.findUserByPhone })
    Object.defineProperty(prisma.user, 'create', { configurable: true, value: originals.createUser })
    Object.defineProperty(prisma.appointment, 'findMany', { configurable: true, value: originals.findAppointments })
    Object.defineProperty(prisma.appointment, 'findFirst', { configurable: true, value: originals.findAppointment })
    Object.defineProperty(prisma.appointment, 'create', { configurable: true, value: originals.createAppointment })
    Object.defineProperty(prisma.appointment, 'update', { configurable: true, value: originals.updateAppointment })
    Object.defineProperty(prisma.holiday, 'findMany', { configurable: true, value: originals.findHolidays })
    Object.defineProperty(prisma.barberAbsence, 'findMany', { configurable: true, value: originals.findAbsences })
    Object.defineProperty(prisma.barberSchedule, 'findMany', { configurable: true, value: originals.findBarberSchedule })
  })

  it('blocks a BARBER from scheduling another barber', async () => {
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}/walk-in`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        barberId: ids.otherBarber, serviceId: ids.service, scheduledAt: '2099-08-05T13:00:00.000Z', userId: ids.customer,
      }) })
      assert.equal(response.status, 403)
    } finally { server.close() }
  })

  it('reuses a customer by normalized phone and never creates checkout', async () => {
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}/walk-in`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        barberId: ids.barber, serviceId: ids.service, scheduledAt: '2099-08-05T13:00:00.000Z', name: 'Marina', phone: '(11) 99999-9999',
      }) })
      assert.equal(response.status, 201)
      const body = await response.json() as { checkoutUrl: unknown; appointment: Record<string, unknown> }
      assert.equal(createdUsers, 0)
      assert.equal(body.checkoutUrl, null)
      assert.equal(body.appointment.status, 'CONFIRMED')
      assert.equal(body.appointment.paymentStatus, 'NOT_REQUIRED')
    } finally { server.close() }
  })

  it('uses the shared schedule validation for lunch, holidays and conflicts', async () => {
    const { server, url } = await startApp()
    const post = (scheduledAt: string) => fetch(`${url}/walk-in`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      barberId: ids.barber, serviceId: ids.service, scheduledAt, userId: ids.customer,
    }) })
    try {
      assert.equal((await post('2099-08-05T15:15:00.000Z')).status, 400)
      holidays = [{ date: new Date('2099-08-05T00:00:00.000Z'), description: 'Feriado municipal' }]
      assert.equal((await post('2099-08-05T13:00:00.000Z')).status, 400)
      holidays = []
      scheduled = [{ id: 'other', scheduledAt: new Date('2099-08-05T13:00:00.000Z'), service }]
      assert.equal((await post('2099-08-05T13:00:00.000Z')).status, 409)
    } finally { server.close() }
  })

  it('never lets a customer mark NO_SHOW', async () => {
    sessionRole = 'CUSTOMER'
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}/${ids.appointment}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'NO_SHOW' }) })
      assert.equal(response.status, 403)
      assert.equal(updatedData, undefined)
    } finally { server.close() }
  })

  it('marks a confirmed appointment NO_SHOW without refunding an approved deposit', async () => {
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}/${ids.appointment}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'NO_SHOW' }) })
      assert.equal(response.status, 200)
      const body = await response.json() as { status: string; paymentStatus: string; depositRetained: boolean }
      assert.deepEqual(updatedData, { status: 'NO_SHOW' })
      assert.equal(body.status, 'NO_SHOW')
      assert.equal(body.paymentStatus, 'APPROVED')
      assert.equal(body.depositRetained, true)
    } finally { server.close() }
  })
})
