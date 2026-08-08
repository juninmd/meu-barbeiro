import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Prisma } from '@prisma/client'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errors.js'
import { servicesRoutes } from './services.routes.js'

describe('services routes', () => {
  it('returns a product message when the service name already exists', async () => {
    const findBarbershop = prisma.barbershop.findUnique
    const findMembership = prisma.membership.findUnique
    const createService = prisma.service.create
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: async () => ({
      id: 'barbershop-1',
      depositType: 'FULL',
      depositValue: 0,
      businessHours: [],
    }) as never })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: async () => ({ role: 'OWNER' }) as never })
    Object.defineProperty(prisma.service, 'create', { configurable: true, value: async () => {
      throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.1.0',
        meta: { target: ['barbershopId', 'name'] },
      })
    } })

    const app = express()
    app.use(express.json())
    app.use((req, _res, next) => {
      req.user = { id: 'user-1', role: 'ADMIN' } as Express.User
      next()
    })
    app.use('/services', servicesRoutes)
    app.use(errorHandler)
    const server = app.listen(0, '127.0.0.1')

    try {
      await new Promise<void>((resolve) => server.once('listening', resolve))
      const address = server.address()
      assert(address && typeof address !== 'string')
      const response = await fetch(`http://127.0.0.1:${address.port}/services`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Corte assinatura', duration: 45, price: 55 }),
      })

      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), { message: 'Já existe um serviço com esse nome' })
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
      Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: findBarbershop })
      Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: findMembership })
      Object.defineProperty(prisma.service, 'create', { configurable: true, value: createService })
    }
  })
})
