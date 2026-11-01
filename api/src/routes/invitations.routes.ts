import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { hashInvitationToken, invitationIsUsable, invitationState } from '../lib/invitations.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'

const router = Router()
const tokenSchema = z.string().min(20).max(200)

const invitationSelect = {
  id: true,
  email: true,
  role: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  barbershop: { select: { name: true, slug: true, logoUrl: true } },
  invitedBy: { select: { name: true } },
} as const

const publicInvitation = (invitation: {
  id: string
  email: string
  role: string
  expiresAt: Date
  acceptedAt: Date | null
  revokedAt: Date | null
  barbershop: { name: string; slug: string; logoUrl: string | null }
  invitedBy: { name: string }
}) => ({
  id: invitation.id,
  email: invitation.email,
  role: invitation.role,
  expiresAt: invitation.expiresAt.toISOString(),
  state: invitationState(invitation),
  barbershop: invitation.barbershop,
  invitedByName: invitation.invitedBy.name,
})

/** Prévia pública: a tela de convite mostra para qual barbearia o link leva. */
router.get('/:token', async (req, res, next) => {
  try {
    const token = tokenSchema.parse(req.params.token)
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
      select: invitationSelect,
    })
    if (!invitation) {
      res.status(404).json({ message: 'Convite não encontrado', code: 'INVITATION_NOT_FOUND' })
      return
    }
    res.json(publicInvitation(invitation))
  } catch (error) {
    next(error)
  }
})

/** Aceite: exige login, e o e-mail da conta precisa ser o e-mail convidado. */
router.post('/:token/accept', requireUser, async (req, res, next) => {
  try {
    const token = tokenSchema.parse(req.params.token)
    const user = req.user as SessionUser
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
      include: { barbershop: { select: { id: true, name: true, slug: true } } },
    })
    if (!invitation) {
      res.status(404).json({ message: 'Convite não encontrado', code: 'INVITATION_NOT_FOUND' })
      return
    }
    if (!invitationIsUsable(invitation)) {
      res.status(410).json({
        message: 'Este convite não pode mais ser usado',
        code: 'INVITATION_NOT_USABLE',
        state: invitationState(invitation),
      })
      return
    }
    if (!user.email || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      res.status(403).json({
        message: `Entre com o e-mail ${invitation.email} para aceitar o convite`,
        code: 'EMAIL_MISMATCH',
        invitedEmail: invitation.email,
      })
      return
    }

    const membership = await prisma.$transaction(async (tx) => {
      const saved = await tx.membership.upsert({
        where: { barbershopId_userId: { barbershopId: invitation.barbershopId, userId: user.id } },
        update: { role: invitation.role },
        create: { barbershopId: invitation.barbershopId, userId: user.id, role: invitation.role },
      })
      await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } })
      if (user.role === 'CUSTOMER') {
        await tx.user.update({
          where: { id: user.id },
          data: { role: invitation.role === 'BARBER' ? 'BARBER' : 'ADMIN' },
        })
      }
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          barbershopId: invitation.barbershopId,
          action: 'membership.accepted',
          target: user.id,
          metadata: { role: invitation.role, invitationId: invitation.id },
        },
      })
      return saved
    })

    res.json({
      membership: { role: membership.role },
      barbershop: invitation.barbershop,
    })
  } catch (error) {
    next(error)
  }
})

export { router as invitationsRoutes }
