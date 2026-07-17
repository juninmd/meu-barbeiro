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
    assert.throws(() => box.decrypt(`${encrypted.slice(0, -1)}x`))
  })
})
