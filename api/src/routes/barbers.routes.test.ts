import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errors.js'
import { barbersRoutes } from './barbers.routes.js'

const ids = {
  barber: '00000000-0000-4000-8000-000000000001',
  otherBarber: '00000000-0000-4000-8000-000000000002',
}

const originals = {
  findBarbershop: prisma.barbershop.findUnique,
  findMembership: prisma.membership.findUnique,
  findTargetMembership: prisma.membership.findFirst,
  findAppointments: prisma.appointment.findMany,
  createAbsence: prisma.barberAbsence.create,
}

let membershipRole = 'BARBER'

async function startApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: ids.barber, role: 'BARBER' } as Express.User
    next()
  })
  app.use('/barbers', barbersRoutes)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  return { server, url: `http://127.0.0.1:${address.port}/barbers` }
}

describe('barber availability routes', () => {
  beforeEach(() => {
    membershipRole = 'BARBER'
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: async () => ({
      id: 'barbershop-1', businessHours: [],
    }) })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: async () => ({ role: membershipRole }) })
    Object.defineProperty(prisma.membership, 'findFirst', { configurable: true, value: async () => ({ id: 'membership-1' }) })
    Object.defineProperty(prisma.appointment, 'findMany', { configurable: true, value: async () => [] })
    Object.defineProperty(prisma.barberAbsence, 'create', { configurable: true, value: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'absence-1', ...data }) })
  })

  afterEach(() => {
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: originals.findBarbershop })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: originals.findMembership })
    Object.defineProperty(prisma.membership, 'findFirst', { configurable: true, value: originals.findTargetMembership })
    Object.defineProperty(prisma.appointment, 'findMany', { configurable: true, value: originals.findAppointments })
    Object.defineProperty(prisma.barberAbsence, 'create', { configurable: true, value: originals.createAbsence })
  })

  it('does not let a BARBER create an absence for another barber', async () => {
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}/${ids.otherBarber}/absences`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ startsAt: '2099-08-05T12:00:00.000Z', endsAt: '2099-08-05T13:00:00.000Z', reason: 'Curso' }),
      })
      assert.equal(response.status, 403)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('returns 409 and the number of appointments overlapping an absence', async () => {
    membershipRole = 'OWNER'
    Object.defineProperty(prisma.appointment, 'findMany', { configurable: true, value: async () => [{
      scheduledAt: new Date('2099-08-05T12:30:00.000Z'),
      service: { duration: 30 },
    }] })
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}/${ids.otherBarber}/absences`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ startsAt: '2099-08-05T12:00:00.000Z', endsAt: '2099-08-05T13:00:00.000Z', reason: 'Curso' }),
      })
      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), {
        message: '1 atendimento conflita com esta ausência',
        conflicts: 1,
      })
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })
})
