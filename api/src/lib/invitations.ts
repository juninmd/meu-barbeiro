import { createHash, randomBytes } from 'node:crypto'
import { INVITATION_TTL_DAYS } from '../domain/plans.js'

export interface InvitationToken {
  /** Vai no link enviado por e-mail. Nunca é gravado no banco. */
  token: string
  /** SHA-256 do token, é o que fica no banco. */
  hash: string
}

export function createInvitationToken(): InvitationToken {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashInvitationToken(token) }
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function invitationExpiresAt(now = new Date(), days = INVITATION_TTL_DAYS): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
}

export function invitationAcceptUrl(token: string, frontendUrl: string): string {
  return `${frontendUrl.replace(/\/$/, '')}/convite/${encodeURIComponent(token)}`
}

export type InvitationState = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'

export function invitationState(
  invitation: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now = new Date(),
): InvitationState {
  if (invitation.acceptedAt) return 'ACCEPTED'
  if (invitation.revokedAt) return 'REVOKED'
  if (invitation.expiresAt.getTime() <= now.getTime()) return 'EXPIRED'
  return 'PENDING'
}

export function invitationIsUsable(
  invitation: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now = new Date(),
): boolean {
  return invitationState(invitation, now) === 'PENDING'
}
