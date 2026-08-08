import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SecretBox } from './secrets.js'

describe('SecretBox', () => {
  it('encrypts Mercado Pago seller tokens with authenticated encryption', () => {
    const key = Buffer.alloc(32, 7).toString('base64')
    const box = new SecretBox(key)
    const encrypted = box.encrypt('APP_USR-sensitive-token')

    assert.notEqual(encrypted.includes('APP_USR-sensitive-token'), true)
    assert.equal(box.decrypt(encrypted), 'APP_USR-sensitive-token')
    const parts = encrypted.split('.')
    const tampered = Buffer.from(parts[3] ?? '', 'base64url')
    tampered[0] = (tampered[0] ?? 0) ^ 1
    parts[3] = tampered.toString('base64url')
    assert.throws(() => box.decrypt(parts.join('.')))
  })
})
