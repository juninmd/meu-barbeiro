import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errors.js'
import { reviewsRoutes } from './reviews.routes.js'

const originals = { shop: prisma.barbershop.findUnique, appointment: prisma.appointment.findFirst, create: prisma.review.create }
afterEach(() => {
  Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: originals.shop })
  Object.defineProperty(prisma.appointment, 'findFirst', { configurable: true, value: originals.appointment })
  Object.defineProperty(prisma.review, 'create', { configurable: true, value: originals.create })
})

const start = async (appointment: unknown) => {
  Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: async () => ({ id: 'shop-1', businessHours: [] }) })
  Object.defineProperty(prisma.appointment, 'findFirst', { configurable: true, value: async () => appointment })
  const created: unknown[] = []
  Object.defineProperty(prisma.review, 'create', { configurable: true, value: async ({ data }: { data: Record<string, unknown> }) => { created.push(data); return { ...data } } })
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { req.user = { id: 'customer-1', role: 'CUSTOMER' } as Express.User; next() })
  app.use('/reviews', reviewsRoutes)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  return { url: `http://127.0.0.1:${address.port}/reviews`, created, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
}

const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const id = '6432e0b7-2306-4147-82f7-809028755011'

test('reviews a completed appointment once and stores the barber who served', async () => {
  const app = await start({ id, status: 'DONE', barberId: 'barber-1', review: null })
  try {
    const response = await post(app.url, { appointmentId: id, rating: 5, comment: '  Excelente  ' })
    assert.equal(response.status, 201)
    assert.deepEqual(app.created[0], { barbershopId: 'shop-1', appointmentId: id, userId: 'customer-1', barberId: 'barber-1', rating: 5, comment: 'Excelente' })
  } finally { await app.close() }
})

test('rejects unfinished, already reviewed and foreign appointments', async () => {
  for (const [appointment, status] of [
    [{ id, status: 'CONFIRMED', barberId: 'b', review: null }, 409],
    [{ id, status: 'DONE', barberId: 'b', review: { id: 'x' } }, 409],
    [null, 404],
  ] as const) {
    const app = await start(appointment)
    try {
      assert.equal((await post(app.url, { appointmentId: id, rating: 4 })).status, status)
      assert.equal(app.created.length, 0)
    } finally { await app.close() }
  }
})

test('validates the rating range', async () => {
  const app = await start({ id, status: 'DONE', barberId: 'b', review: null })
  try {
    for (const rating of [0, 6, 3.5]) assert.equal((await post(app.url, { appointmentId: id, rating })).status, 400)
  } finally { await app.close() }
})
