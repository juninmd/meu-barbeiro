import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errors.js'
import { productsRoutes } from './products.routes.js'

const originals = {
  findBarbershop: prisma.barbershop.findUnique,
  findMembership: prisma.membership.findUnique,
  countSales: prisma.productSale.count,
  deleteProduct: prisma.product.delete,
  transaction: prisma.$transaction,
}

const startApp = async () => {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: 'user-1', role: 'BARBER' } as Express.User
    next()
  })
  app.use('/products', productsRoutes)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  return { server, url: `http://127.0.0.1:${address.port}/products` }
}

describe('products routes', () => {
  beforeEach(() => {
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: async () => ({
      id: 'barbershop-1',
      timezone: 'America/Sao_Paulo',
      businessHours: [],
    }) as never })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: async () => ({ role: 'OWNER' }) as never })
  })

  afterEach(() => {
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: originals.findBarbershop })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: originals.findMembership })
    Object.defineProperty(prisma.productSale, 'count', { configurable: true, value: originals.countSales })
    Object.defineProperty(prisma.product, 'delete', { configurable: true, value: originals.deleteProduct })
    Object.defineProperty(prisma, '$transaction', { configurable: true, value: originals.transaction })
  })

  it('rejects a sale when stock is insufficient', async () => {
    Object.defineProperty(prisma, '$transaction', { configurable: true, value: async (operation: (tx: object) => unknown) => operation({
      product: {
        findUnique: async () => ({ id: '11111111-1111-4111-8111-111111111111', active: true, priceCents: 2_500, stockQuantity: 1 }),
        updateMany: async () => ({ count: 0 }),
      },
      productSale: { create: async () => assert.fail('sale must not be created') },
      appointment: { findFirst: async () => null },
    }) })
    const { server, url } = await startApp()

    try {
      const response = await fetch(`${url}/11111111-1111-4111-8111-111111111111/sales`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quantity: 2 }),
      })

      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), { message: 'Estoque insuficiente. Disponível: 1' })
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('decrements stock and records the current unit price in one transaction', async () => {
    let decrementedBy = 0
    let saleData: Record<string, unknown> | undefined
    Object.defineProperty(prisma, '$transaction', { configurable: true, value: async (operation: (tx: object) => unknown) => operation({
      product: {
        findUnique: async () => ({ id: '11111111-1111-4111-8111-111111111111', name: 'Pomada', active: true, priceCents: 2_500, stockQuantity: 5 }),
        updateMany: async ({ data }: { data: { stockQuantity: { decrement: number } } }) => {
          decrementedBy = data.stockQuantity.decrement
          return { count: 1 }
        },
      },
      productSale: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          saleData = data
          return {
            id: 'sale-1',
            ...data,
            createdAt: new Date('2026-08-08T12:00:00.000Z'),
            product: { id: '11111111-1111-4111-8111-111111111111', name: 'Pomada' },
            soldBy: { id: 'user-1', name: 'Rafael Navalha' },
          }
        },
      },
      appointment: { findFirst: async () => null },
    }) })
    const { server, url } = await startApp()

    try {
      const response = await fetch(`${url}/11111111-1111-4111-8111-111111111111/sales`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quantity: 2 }),
      })

      assert.equal(response.status, 201)
      assert.equal(decrementedBy, 2)
      assert.equal(saleData?.unitPriceCents, 2_500)
      assert.equal(saleData?.soldById, 'user-1')
      assert.deepEqual(await response.json(), {
        id: 'sale-1',
        product: { id: '11111111-1111-4111-8111-111111111111', name: 'Pomada' },
        quantity: 2,
        unitPrice: 25,
        total: 50,
        soldBy: { id: 'user-1', name: 'Rafael Navalha' },
        appointmentId: null,
        createdAt: '2026-08-08T12:00:00.000Z',
      })
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('blocks deletion when the product has recorded sales', async () => {
    Object.defineProperty(prisma.productSale, 'count', { configurable: true, value: async () => 1 })
    Object.defineProperty(prisma.product, 'delete', { configurable: true, value: async () => assert.fail('product must not be deleted') })
    const { server, url } = await startApp()

    try {
      const response = await fetch(`${url}/11111111-1111-4111-8111-111111111111`, { method: 'DELETE' })

      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), {
        message: 'Produto possui vendas registradas. Desative-o para preservar o histórico.',
      })
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })
})
