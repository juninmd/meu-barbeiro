import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createInvitationToken,
  hashInvitationToken,
  invitationAcceptUrl,
  invitationExpiresAt,
  invitationIsUsable,
  invitationState,
} from './invitations.js'

describe('invitation tokens', () => {
  it('creates a URL-safe token and stores only its hash', () => {
    const { token, hash } = createInvitationToken()
    assert.match(token, /^[A-Za-z0-9_-]{40,}$/)
    assert.match(hash, /^[a-f0-9]{64}$/)
    assert.equal(hash, hashInvitationToken(token))
    assert.notEqual(hash, token)
  })

  it('never repeats a token', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => createInvitationToken().token))
    assert.equal(tokens.size, 50)
  })

  it('builds the accept link without duplicating slashes', () => {
    assert.equal(
      invitationAcceptUrl('abc', 'https://app.meubarbeiro.com/'),
      'https://app.meubarbeiro.com/convite/abc',
    )
  })
})

describe('invitation lifecycle', () => {
  const base = { acceptedAt: null, revokedAt: null, expiresAt: new Date('2026-11-07T12:00:00.000Z') }

  it('expires after seven days', () => {
    const now = new Date('2026-10-31T12:00:00.000Z')
    const days = Math.round((invitationExpiresAt(now).getTime() - now.getTime()) / 86_400_000)
    assert.equal(days, 7)
  })

  it('is usable while pending', () => {
    assert.equal(invitationIsUsable(base, new Date('2026-11-01T00:00:00.000Z')), true)
    assert.equal(invitationState(base, new Date('2026-11-01T00:00:00.000Z')), 'PENDING')
  })

  it('is not usable after acceptance, revocation or expiry', () => {
    const now = new Date('2026-11-08T00:00:00.000Z')
    assert.equal(invitationIsUsable({ ...base, acceptedAt: new Date() }, now), false)
    assert.equal(invitationState({ ...base, revokedAt: new Date() }, now), 'REVOKED')
    assert.equal(invitationState(base, now), 'EXPIRED')
  })
})
