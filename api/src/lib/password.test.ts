import assert from 'node:assert/strict'
import test from 'node:test'
import { hashPassword, verifyPassword } from './password.js'

test('hash is salted and verifies only the right password', async () => {
  const first = await hashPassword('senha-forte-123')
  const second = await hashPassword('senha-forte-123')
  assert.notEqual(first, second)
  assert.match(first, /^scrypt\$\d+\$/)
  assert.equal(await verifyPassword('senha-forte-123', first), true)
  assert.equal(await verifyPassword('senha-forte-124', first), false)
})

test('verify rejects missing or malformed hashes', async () => {
  assert.equal(await verifyPassword('x', null), false)
  assert.equal(await verifyPassword('x', 'plain-text'), false)
  assert.equal(await verifyPassword('x', 'bcrypt$1$a$b'), false)
})
