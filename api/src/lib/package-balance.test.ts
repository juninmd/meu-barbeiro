import assert from 'node:assert/strict'
import test from 'node:test'
import { expiryFrom, packageStatus, remainingSessions } from './package-balance.js'

const now = new Date('2026-07-17T12:00:00Z')
const day = 86_400_000

test('status reflects balance and validity', () => {
  assert.equal(packageStatus({ sessionsTotal: 5, sessionsUsed: 2, expiresAt: new Date(now.getTime() + day) }, now), 'ACTIVE')
  assert.equal(packageStatus({ sessionsTotal: 5, sessionsUsed: 5, expiresAt: new Date(now.getTime() + day) }, now), 'EXHAUSTED')
  assert.equal(packageStatus({ sessionsTotal: 5, sessionsUsed: 2, expiresAt: new Date(now.getTime() - 1) }, now), 'EXPIRED')
  assert.equal(packageStatus({ sessionsTotal: 5, sessionsUsed: 5, expiresAt: new Date(now.getTime() - day) }, now), 'EXHAUSTED')
})

test('remaining never goes negative and expiry adds whole days', () => {
  assert.equal(remainingSessions({ sessionsTotal: 5, sessionsUsed: 2 }), 3)
  assert.equal(remainingSessions({ sessionsTotal: 5, sessionsUsed: 9 }), 0)
  assert.equal(expiryFrom(now, 30).toISOString(), '2026-08-16T12:00:00.000Z')
})
