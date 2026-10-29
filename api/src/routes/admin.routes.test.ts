import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errors.js'
import { adminRoutes } from './admin.routes.js'
import { accountRoutes } from './account.routes.js'
import { barbershopsRoutes } from './barbershops.routes.js'

const originals = { update: prisma.user.update, count: prisma.user.count }
afterEach(() => {
  Object.defineProperty(prisma.user, 'update', { configurable: true, value: originals.update })
  Object.defineProperty(prisma.user, 'count', { configurable: true, value: originals.count })
})

const start = async (user: Record<string, unknown> | null) => {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { if (user) req.user = user as Express.User; next() })
  app.use('/admin', adminRoutes)
  app.use('/account', accountRoutes)
  app.use('/barbershops', barbershopsRoutes)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  return { url: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
}

const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

test('admin area requires authentication and the platform admin flag', async () => {
  for (const [user, status] of [[null, 401], [{ id: 'u', platformAdmin: false }, 403]] as const) {
    const app = await start(user)
    try {
      assert.equal((await fetch(`${app.url}/admin/overview`)).status, status)
    } finally { await app.close() }
  }
})

test('only the platform admin can decide an establishment request', async () => {
  const decisions: unknown[] = []
  Object.defineProperty(prisma.user, 'update', { configurable: true, value: async (args: unknown) => { decisions.push(args); return { id: 'x' } } })
  const customer = await start({ id: 'u', platformAdmin: false, role: 'CUSTOMER' })
  try {
    const id = '6432e0b7-2306-4147-82f7-809028755011'
    assert.equal((await post(`${customer.url}/admin/users/${id}/establishment-decision`, { decision: 'APPROVED' })).status, 403)
  } finally { await customer.close() }
  assert.equal(decisions.length, 0)

  const admin = await start({ id: 'a', platformAdmin: true, role: 'ADMIN' })
  try {
    const id = '6432e0b7-2306-4147-82f7-809028755011'
    assert.equal((await post(`${admin.url}/admin/users/${id}/establishment-decision`, { decision: 'APPROVED' })).status, 200)
    assert.equal((await post(`${admin.url}/admin/users/${id}/establishment-decision`, { decision: 'HACK' })).status, 400)
  } finally { await admin.close() }
  assert.equal(decisions.length, 1)
})

test('establishment request cannot be duplicated while pending or approved', async () => {
  for (const establishmentRequest of ['PENDING', 'APPROVED']) {
    const app = await start({ id: 'u', establishmentRequest })
    try {
      assert.equal((await post(`${app.url}/account/establishment-request`, { note: 'Minha barbearia' })).status, 409)
    } finally { await app.close() }
  }
})

test('registering an establishment needs the admin approval', async () => {
  const app = await start({ id: 'u', establishmentRequest: 'PENDING', platformAdmin: false })
  try {
    const response = await post(`${app.url}/barbershops`, { name: 'Barbearia Nova', slug: 'barbearia-nova' })
    assert.equal(response.status, 403)
  } finally { await app.close() }
})
