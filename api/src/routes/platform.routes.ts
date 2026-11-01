import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import type { NextFunction, Request, Response } from 'express'
import { requireUser, type SessionUser } from '../middleware/auth.js'
import { SAAS_PLAN_LIST, planById, planOrDefault, subscriptionSnapshot } from '../domain/plans.js'
import { audit } from '../lib/audit.js'

const router = Router()

const requirePlatformAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!(req.user as SessionUser | undefined)?.platformAdmin) {
    res.status(403).json({ message: 'Acesso restrito ao administrador da plataforma', code: 'PLATFORM_ADMIN_REQUIRED' })
    return
  }
  next()
}

router.use(requireUser, requirePlatformAdmin)

const pagination = z.object({
  search: z.string().trim().max(80).optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
})

/**
 * Visão do operador do SaaS: quantas barbearias existem, quanto entra por mês
 * e quantas estão em teste prestes a vencer.
 */
router.get('/overview', async (_req, res, next) => {
  try {
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 86_400_000)
    const last30Days = new Date(now.getTime() - 30 * 86_400_000)

    const [total, byStatus, activeRevenue, trials, expiringSoon, newShops, appointments30d, cancellations30d] = await Promise.all([
      prisma.barbershop.count(),
      prisma.barbershop.groupBy({ by: ['subscriptionStatus'], _count: { _all: true } }),
      prisma.barbershop.aggregate({
        where: { subscriptionStatus: 'ACTIVE' },
        _sum: { monthlyFeeCents: true },
        _count: { _all: true },
      }),
      prisma.barbershop.count({ where: { subscriptionStatus: 'TRIALING', trialEndsAt: { gt: now } } }),
      prisma.barbershop.count({
        where: { subscriptionStatus: 'TRIALING', trialEndsAt: { gt: now, lte: in30Days } },
      }),
      prisma.barbershop.count({ where: { createdAt: { gte: last30Days } } }),
      prisma.appointment.count({ where: { createdAt: { gte: last30Days } } }),
      prisma.appointmentCancellation.count({ where: { createdAt: { gte: last30Days } } }),
    ])

    const statuses = Object.fromEntries(byStatus.map((row) => [row.subscriptionStatus, row._count._all])) as Record<string, number>
    const mrrCents = activeRevenue._sum.monthlyFeeCents ?? 0

    res.json({
      generatedAt: now.toISOString(),
      shops: {
        total,
        newLast30Days: newShops,
        byStatus: statuses,
        trialing: trials,
        trialsExpiringIn30Days: expiringSoon,
      },
      revenue: {
        mrrCents,
        arrCents: mrrCents * 12,
        payingShops: activeRevenue._count._all,
      },
      usage: {
        appointmentsLast30Days: appointments30d,
        cancellationsLast30Days: cancellations30d,
      },
      plans: SAAS_PLAN_LIST.map((plan) => ({
        id: plan.id,
        name: plan.name,
        monthlyFeeCents: plan.monthlyFeeCents,
        shops: 0,
      })),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/barbershops', async (req, res, next) => {
  try {
    const query = pagination.parse(req.query)
    const where: Prisma.BarbershopWhereInput | null = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { slug: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : null
    const shops = await prisma.barbershop.findMany({
      ...(where ? { where } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        monthlyFeeCents: true,
        createdAt: true,
        billingEmail: true,
        _count: { select: { memberships: true, appointments: true } },
      },
    })
    const hasMore = shops.length > query.take
    const page = hasMore ? shops.slice(0, query.take) : shops
    res.json({
      items: page.map((shop) => ({
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        plan: planOrDefault(shop.plan).id,
        subscriptionStatus: shop.subscriptionStatus,
        subscription: subscriptionSnapshot(shop),
        monthlyFeeCents: shop.monthlyFeeCents,
        billingEmail: shop.billingEmail,
        professionals: shop._count.memberships,
        appointments: shop._count.appointments,
        createdAt: shop.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    })
  } catch (error) {
    next(error)
  }
})

router.patch('/barbershops/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const input = z.object({
      plan: z.enum(['STARTER', 'PRO', 'SCALE']).optional(),
      subscriptionStatus: z.enum(['INACTIVE', 'PENDING', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED']).optional(),
      extendTrialDays: z.number().int().min(1).max(90).optional(),
      keepMonthlyFee: z.boolean().optional(),
    }).parse(req.body)

    const shop = await prisma.barbershop.findUnique({ where: { id } })
    if (!shop) {
      res.status(404).json({ message: 'Barbearia não encontrada', code: 'SHOP_NOT_FOUND' })
      return
    }

    const plan = input.plan ? planById(input.plan)! : planOrDefault(shop.plan)
    const data: Record<string, unknown> = {}
    if (input.plan) {
      data.plan = plan.id
      if (!input.keepMonthlyFee) data.monthlyFeeCents = plan.monthlyFeeCents
    }
    if (input.subscriptionStatus) {
      data.subscriptionStatus = input.subscriptionStatus
      data.canceledAt = input.subscriptionStatus === 'CANCELED' ? new Date() : null
    }
    if (input.extendTrialDays) {
      const base = shop.trialEndsAt && shop.trialEndsAt > new Date() ? shop.trialEndsAt : new Date()
      data.trialEndsAt = new Date(base.getTime() + input.extendTrialDays * 86_400_000)
      data.subscriptionStatus = 'TRIALING'
      data.canceledAt = null
    }

    const updated = await prisma.barbershop.update({ where: { id }, data })
    await audit({
      actorId: (req.user as SessionUser).id,
      barbershopId: id,
      action: 'platform.shop-updated',
      metadata: { ...input, plan: plan.id },
    })
    res.json({
      id: updated.id,
      plan: updated.plan,
      subscriptionStatus: updated.subscriptionStatus,
      trialEndsAt: updated.trialEndsAt?.toISOString() ?? null,
      monthlyFeeCents: updated.monthlyFeeCents,
      subscription: subscriptionSnapshot(updated),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/audit', async (req, res, next) => {
  try {
    const query = z.object({ take: z.coerce.number().int().min(1).max(200).default(50) }).parse(req.query)
    const entries = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: query.take })
    res.json({
      items: entries.map((entry) => ({
        id: entry.id,
        action: entry.action,
        actorId: entry.actorId,
        barbershopId: entry.barbershopId,
        target: entry.target,
        metadata: entry.metadata,
        createdAt: entry.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    next(error)
  }
})

export { router as platformRoutes }
