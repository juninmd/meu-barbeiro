import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import { ensurePlatformAdmin } from './bootstrap-admin.js'
import { prisma } from './prisma.js'

const original = prisma.user.upsert
const originalFind = prisma.user.findUnique
const originalCount = prisma.user.count
afterEach(() => {
  Object.defineProperty(prisma.user, 'count', { configurable: true, value: originalCount })
  Object.defineProperty(prisma.user, 'upsert', { configurable: true, value: original })
  Object.defineProperty(prisma.user, 'findUnique', { configurable: true, value: originalFind })
})

const stub = (admins = 1) => {
  Object.defineProperty(prisma.user, 'count', { configurable: true, value: async () => admins })
  const calls: Array<{ create: Record<string, unknown>; update: Record<string, unknown> }> = []
  Object.defineProperty(prisma.user, 'findUnique', { configurable: true, value: async () => null })
  Object.defineProperty(prisma.user, 'upsert', { configurable: true, value: async (args: never) => { calls.push(args); return {} } })
  return calls
}

test('keeps the existing admin when ADMIN_PASSWORD is missing', async () => {
  const calls = stub(1)
  assert.equal(await ensurePlatformAdmin({ NODE_ENV: 'production' }), 'skipped')
  assert.equal(calls.length, 0)
})

test('fails fast in production when there is no admin and no password', async () => {
  stub(0)
  await assert.rejects(ensurePlatformAdmin({ NODE_ENV: 'production' }), /ADMIN_PASSWORD não definido/)
  await assert.rejects(ensurePlatformAdmin({ NODE_ENV: 'production', ADMIN_PASSWORD: 'admin' }), /ao menos 12/)
})

test('refuses short passwords in production without touching the admin', async () => {
  const calls = stub(1)
  assert.equal(await ensurePlatformAdmin({ NODE_ENV: 'production', ADMIN_PASSWORD: 'admin' }), 'skipped')
  assert.equal(calls.length, 0)
})

test('does nothing outside production without a password', async () => {
  const calls = stub(0)
  assert.equal(await ensurePlatformAdmin({ NODE_ENV: 'development' }), 'skipped')
  assert.equal(calls.length, 0)
})

test('creates a platform admin with a hashed password', async () => {
  const calls = stub()
  assert.equal(await ensurePlatformAdmin({ NODE_ENV: 'production', ADMIN_PASSWORD: 'uma-senha-bem-longa', ADMIN_USERNAME: 'Root' }), 'created')
  const { create } = calls[0]!
  assert.equal(create.username, 'root')
  assert.equal(create.platformAdmin, true)
  assert.notEqual(create.passwordHash, 'uma-senha-bem-longa')
})

test('allows a short password outside production (local seed)', async () => {
  const calls = stub()
  assert.equal(await ensurePlatformAdmin({ NODE_ENV: 'development', ADMIN_PASSWORD: 'admin' }), 'created')
  assert.equal(calls.length, 1)
})
