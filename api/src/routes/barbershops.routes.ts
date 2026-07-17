import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { resolveBarbershop, requireBarbershopRole } from '../middleware/barbershop.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'
import { calculateCommissionCents } from '../domain/billing.js'

const router = Router()
const hourSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  opensAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  closesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  enabled: z.boolean(),
}).refine((value) => !value.enabled || value.opensAt < value.closesAt, 'Abertura deve ser anterior ao fechamento')

const defaultHours = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  opensAt: '09:00',
  closesAt: '20:00',
  enabled: weekday >= 2 && weekday <= 6,
}))

const settingsSchema = z.object({
  name: z.string().trim().min(3).max(80),
  logoUrl: z.union([z.string().url().max(500), z.literal(''), z.null()]).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  address: z.union([z.string().trim().max(160), z.null()]).optional(),
  timezone: z.string().trim().min(3).max(80),
  depositType: z.enum(['NONE', 'PERCENTAGE', 'FIXED', 'FULL']),
  depositValue: z.number().int().min(0),
  businessHours: z.array(hourSchema).length(7),
}).superRefine((value, context) => {
  if (value.depositType === 'PERCENTAGE' && value.depositValue > 100) {
    context.addIssue({ code: 'custom', path: ['depositValue'], message: 'Percentual deve estar entre 0 e 100' })
  }
})

router.post('/', requireUser, async (req, res) => {
  const user = req.user as SessionUser
  const input = z.object({
    name: z.string().trim().min(3).max(80),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(60),
  }).parse(req.body)
  const barbershop = await prisma.$transaction(async (tx) => {
    const created = await tx.barbershop.create({
      data: {
        ...input,
        businessHours: { create: defaultHours },
        memberships: { create: { userId: user.id, role: 'OWNER' } },
      },
      include: { businessHours: { orderBy: { weekday: 'asc' } } },
    })
    await tx.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
    return created
  })
  res.status(201).json(publicBarbershop(barbershop, true))
})

router.get('/current', resolveBarbershop, async (req, res) => {
  const user = req.user as SessionUser | undefined
  const membership = user ? await prisma.membership.findUnique({
    where: { barbershopId_userId: { barbershopId: req.barbershop!.id, userId: user.id } },
  }) : null
  res.json(publicBarbershop(req.barbershop!, Boolean(membership)))
})

router.patch(
  '/current',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN'),
  async (req, res) => {
    const input = settingsSchema.parse(req.body)
    const { businessHours, logoUrl, address, ...settings } = input
    if (input.depositType === 'FIXED') {
      const services = await prisma.service.findMany({
        where: { barbershopId: req.barbershop!.id },
        select: { priceCents: true },
      })
      if (services.some(({ priceCents }) => input.depositValue < calculateCommissionCents(priceCents))) {
        res.status(400).json({ message: 'Sinal fixo deve cobrir a comissão de 1% de todos os serviços' })
        return
      }
    }
    const barbershop = await prisma.$transaction(async (tx) => {
      await tx.barbershop.update({
        where: { id: req.barbershop!.id },
        data: { ...settings, logoUrl: logoUrl || null, address: address || null },
      })
      await Promise.all(businessHours.map((hour) => tx.businessHour.upsert({
        where: { barbershopId_weekday: { barbershopId: req.barbershop!.id, weekday: hour.weekday } },
        update: hour,
        create: { ...hour, barbershopId: req.barbershop!.id },
      })))
      return tx.barbershop.findUniqueOrThrow({
        where: { id: req.barbershop!.id },
        include: { businessHours: { orderBy: { weekday: 'asc' } } },
      })
    })
    res.json(publicBarbershop(barbershop, true))
  },
)

function publicBarbershop(
  barbershop: NonNullable<Express.Request['barbershop']>,
  staff: boolean,
) {
  return {
    id: barbershop.id,
    slug: barbershop.slug,
    name: barbershop.name,
    logoUrl: barbershop.logoUrl,
    primaryColor: barbershop.primaryColor,
    address: barbershop.address,
    timezone: barbershop.timezone,
    depositType: barbershop.depositType,
    depositValue: barbershop.depositValue,
    monthlyFeeCents: barbershop.monthlyFeeCents,
    commissionBps: barbershop.commissionBps,
    businessHours: barbershop.businessHours,
    ...(staff ? {
      subscriptionStatus: barbershop.subscriptionStatus,
      mercadoPagoConnected: Boolean(barbershop.mercadoPagoSellerId),
    } : {}),
  }
}

export { router as barbershopsRoutes }
