import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { isSubscriptionGated, subscriptionSnapshot } from '../domain/plans.js'
import type { SessionUser } from './auth.js'

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Bloqueia escrita da equipe quando o teste grátis ou a assinatura venceu.
 *
 * - Leitura continua liberada (o dono enxerga os próprios dados).
 * - Cliente final continua agendando: o bloqueio é comercial, não operacional.
 * - Cobrança, login, convites e remoção de equipe nunca são bloqueados, senão a
 *   barbearia não consegue pagar para voltar a operar.
 */
export async function enforceSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!isSubscriptionGated(req.method, req.path)) {
      next()
      return
    }
    const user = req.user as SessionUser | undefined
    if (!user) {
      next()
      return
    }
    if (user.platformAdmin) {
      next()
      return
    }

    const slug = req.header('x-barbershop-slug') || process.env.DEFAULT_BARBERSHOP_SLUG || 'barbearia-central'
    if (!slugPattern.test(slug)) {
      next()
      return
    }

    const barbershop = await prisma.barbershop.findUnique({
      where: { slug },
      select: {
        id: true,
        plan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        monthlyFeeCents: true,
        canceledAt: true,
      },
    })
    if (!barbershop) {
      next()
      return
    }

    const membership = await prisma.membership.findUnique({
      where: { barbershopId_userId: { barbershopId: barbershop.id, userId: user.id } },
      select: { role: true },
    })
    if (!membership) {
      next()
      return
    }

    const snapshot = subscriptionSnapshot(barbershop)
    res.locals.subscription = snapshot
    if (!snapshot.isBlocked) {
      next()
      return
    }

    res.status(402).json({
      message: snapshot.state === 'CANCELED'
        ? 'Assinatura cancelada. Reative para voltar a editar a barbearia.'
        : 'Teste grátis encerrado. Escolha um plano para voltar a editar a barbearia.',
      code: 'SUBSCRIPTION_REQUIRED',
      subscription: snapshot,
    })
  } catch (error) {
    next(error)
  }
}
