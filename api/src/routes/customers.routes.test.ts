import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errors.js'
import { customersRoutes } from './customers.routes.js'

const originals = {
  findBarbershop: prisma.barbershop.findUnique,
  findMembership: prisma.membership.findUnique,
  findUser: prisma.user.findFirst,
  findProfile: prisma.customerProfile.findUnique,
  upsertProfile: prisma.customerProfile.upsert,
  findAppointments: prisma.appointment.findMany,
}

let userRole = 'BARBER'
let barbershopId = '11111111-1111-4111-8111-111111111111'
let savedProfile: Record<string, unknown> | undefined

async function startApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: '22222222-2222-4222-8222-222222222222', role: userRole } as Express.User
    next()
  })
  app.use('/customers', customersRoutes)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  return { server, url: `http://127.0.0.1:${address.port}/customers/33333333-3333-4333-8333-333333333333/profile` }
}

describe('customer profiles', () => {
  beforeEach(() => {
    userRole = 'BARBER'
    barbershopId = '11111111-1111-4111-8111-111111111111'
    savedProfile = undefined
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: async () => ({
      id: barbershopId, businessHours: [],
    }) as never })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: async () => ({ role: 'BARBER' }) as never })
    Object.defineProperty(prisma.user, 'findFirst', { configurable: true, value: async () => (
      barbershopId === '11111111-1111-4111-8111-111111111111' ? { id: '33333333-3333-4333-8333-333333333333' } : null
    ) as never })
    Object.defineProperty(prisma.customerProfile, 'findUnique', { configurable: true, value: async ({ where }: { where: { barbershopId_userId: { barbershopId: string } } }) => (
      where.barbershopId_userId.barbershopId === '11111111-1111-4111-8111-111111111111'
        ? {
          id: 'profile-1', preferences: 'Máquina 2 dos lados', notes: 'Prefere silêncio', allergies: 'Produto X',
          updatedAt: new Date('2026-08-08T12:00:00.000Z'), updatedBy: { id: 'barber-1', name: 'Rafael' },
        }
        : null
    ) as never })
    Object.defineProperty(prisma.appointment, 'findMany', { configurable: true, value: async () => [] })
    Object.defineProperty(prisma.customerProfile, 'upsert', { configurable: true, value: async ({ update }: { update: Record<string, unknown> }) => {
      savedProfile = update
      return { id: 'profile-1' }
    } })
  })

  afterEach(() => {
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: originals.findBarbershop })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: originals.findMembership })
    Object.defineProperty(prisma.user, 'findFirst', { configurable: true, value: originals.findUser })
    Object.defineProperty(prisma.customerProfile, 'findUnique', { configurable: true, value: originals.findProfile })
    Object.defineProperty(prisma.customerProfile, 'upsert', { configurable: true, value: originals.upsertProfile })
    Object.defineProperty(prisma.appointment, 'findMany', { configurable: true, value: originals.findAppointments })
  })

  it('never lets a customer read their own internal profile', async () => {
    userRole = 'CUSTOMER'
    const { server, url } = await startApp()
    try {
      const response = await fetch(url)
      assert.equal(response.status, 403)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('lets a barbershop member read the profile and keeps it tenant-scoped', async () => {
    const { server, url } = await startApp()
    try {
      const ownShop = await fetch(url)
      assert.equal(ownShop.status, 200)
      assert.equal((await ownShop.json() as { profile: { notes: string } }).profile.notes, 'Prefere silêncio')

      barbershopId = '44444444-4444-4444-8444-444444444444'
      const otherShop = await fetch(url)
      assert.equal(otherShop.status, 404)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('stores profile changes with the member who updated them', async () => {
    const { server, url } = await startApp()
    try {
      const response = await fetch(url, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ preferences: 'Máquina 2', notes: 'Anotação interna', allergies: null }),
      })
      assert.equal(response.status, 200)
      assert.deepEqual(savedProfile, {
        preferences: 'Máquina 2', notes: 'Anotação interna', allergies: null,
        updatedById: '22222222-2222-4222-8222-222222222222',
      })
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })
})
