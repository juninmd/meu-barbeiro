import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errors.js'
import { packagesRoutes } from './packages.routes.js'

const originals = {
  shop: prisma.barbershop.findUnique, membership: prisma.membership.findUnique,
  findPackage: prisma.customerPackage.findFirst, tx: prisma.$transaction,
}
afterEach(() => {
  Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: originals.shop })
  Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: originals.membership })
  Object.defineProperty(prisma.customerPackage, 'findFirst', { configurable: true, value: originals.findPackage })
  Object.defineProperty(prisma, '$transaction', { configurable: true, value: originals.tx })
})

const start = async (role: 'OWNER' | 'BARBER' | null, customerPackage: unknown = null) => {
  Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: async () => ({ id: 'shop-1', businessHours: [] }) })
  Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: async () => (role ? { role } : null) })
  Object.defineProperty(prisma.customerPackage, 'findFirst', { configurable: true, value: async () => customerPackage })
  let claimed = 0
  Object.defineProperty(prisma, '$transaction', { configurable: true, value: async () => { claimed += 1; return null } })
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { req.user = { id: 'user-1', role: 'ADMIN' } as Express.User; next() })
  app.use('/packages', packagesRoutes)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  return { url: `http://127.0.0.1:${address.port}/packages`, claimed: () => claimed, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
}

const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const valid = { name: '5 cortes', sessions: 5, price: 220, validityDays: 90 }
const id = '6432e0b7-2306-4147-82f7-809028755011'

test('only owners and admins create packages, and the input is validated', async () => {
  const barber = await start('BARBER')
  try { assert.equal((await post(barber.url, valid)).status, 403) } finally { await barber.close() }
  const outsider = await start(null)
  try { assert.equal((await post(outsider.url, valid)).status, 403) } finally { await outsider.close() }
  const owner = await start('OWNER')
  try {
    for (const bad of [{ ...valid, sessions: 1 }, { ...valid, price: 0 }, { ...valid, validityDays: 3 }, { ...valid, extra: true }]) {
      assert.equal((await post(owner.url, bad)).status, 400)
    }
  } finally { await owner.close() }
})

test('redeem refuses exhausted and expired packages without touching the balance', async () => {
  const future = new Date(Date.now() + 86_400_000)
  const past = new Date(Date.now() - 86_400_000)
  for (const [item, message] of [
    [{ id, sessionsTotal: 5, sessionsUsed: 5, expiresAt: future }, 'não tem mais sessões'],
    [{ id, sessionsTotal: 5, sessionsUsed: 1, expiresAt: past }, 'expirou'],
  ] as const) {
    const app = await start('BARBER', item)
    try {
      const response = await post(`${app.url}/customer-packages/${id}/redeem`, {})
      assert.equal(response.status, 409)
      assert.match(((await response.json()) as { message: string }).message, new RegExp(message))
      assert.equal(app.claimed(), 0)
    } finally { await app.close() }
  }
})

test('a lost race on the last session answers 409', async () => {
  const active = { id, sessionsTotal: 5, sessionsUsed: 4, expiresAt: new Date(Date.now() + 86_400_000) }
  const app = await start('BARBER', active)
  try {
    const response = await post(`${app.url}/customer-packages/${id}/redeem`, {})
    assert.equal(response.status, 409)
    assert.equal(app.claimed(), 1)
  } finally { await app.close() }
})
