import { Prisma } from '@prisma/client'
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
  breakStartsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  breakEndsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  enabled: z.boolean(),
}).superRefine((value, context) => {
  if (value.enabled && value.opensAt >= value.closesAt) {
    context.addIssue({ code: 'custom', path: ['opensAt'], message: 'Abertura deve ser anterior ao fechamento' })
  }
  const hasBreakStart = value.breakStartsAt != null
  const hasBreakEnd = value.breakEndsAt != null
  if (!value.enabled && (hasBreakStart || hasBreakEnd)) {
    context.addIssue({ code: 'custom', path: ['breakStartsAt'], message: 'Dia fechado não pode ter horário de almoço' })
    return
  }
  if (hasBreakStart !== hasBreakEnd) {
    context.addIssue({ code: 'custom', path: ['breakStartsAt'], message: 'Informe o início e o fim do almoço' })
    return
  }
  if (!hasBreakStart || !hasBreakEnd) return
  if (value.breakStartsAt! >= value.breakEndsAt!) {
    context.addIssue({ code: 'custom', path: ['breakStartsAt'], message: 'Início do almoço deve ser anterior ao fim' })
    return
  }
  if (value.breakStartsAt! < value.opensAt || value.breakEndsAt! > value.closesAt) {
    context.addIssue({ code: 'custom', path: ['breakStartsAt'], message: 'Almoço deve estar dentro do horário de funcionamento' })
  }
})

const holidayDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').refine(
  (value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value,
  'Data inválida',
)
const holidayInputSchema = z.object({
  date: holidayDateSchema,
  description: z.string().trim().min(3).max(80),
}).strict()
const holidayIdSchema = z.string().uuid()

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
  remindersEnabled: z.boolean().optional(),
  reminderHoursBefore: z.array(z.union([z.literal(24), z.literal(2)]))
    .min(1)
    .max(2)
    .refine((hours) => new Set(hours).size === hours.length, 'Antecedências não podem se repetir')
    .optional(),
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
  res.json({
    ...publicBarbershop(req.barbershop!, Boolean(membership)),
    membershipRole: membership?.role ?? null,
  })
})

router.patch(
  '/current',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN'),
  async (req, res) => {
    const input = settingsSchema.parse(req.body)
    const { businessHours, logoUrl, address, remindersEnabled, reminderHoursBefore, ...settings } = input
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
        data: {
          ...settings,
          logoUrl: logoUrl || null,
          address: address || null,
          ...(remindersEnabled !== undefined ? { remindersEnabled } : {}),
          ...(reminderHoursBefore !== undefined ? { reminderHoursBefore } : {}),
        },
      })
      await Promise.all(businessHours.map((hour) => tx.businessHour.upsert({
        where: { barbershopId_weekday: { barbershopId: req.barbershop!.id, weekday: hour.weekday } },
        update: { ...hour, breakStartsAt: hour.breakStartsAt ?? null, breakEndsAt: hour.breakEndsAt ?? null },
        create: {
          ...hour,
          breakStartsAt: hour.breakStartsAt ?? null,
          breakEndsAt: hour.breakEndsAt ?? null,
          barbershopId: req.barbershop!.id,
        },
      })))
      return tx.barbershop.findUniqueOrThrow({
        where: { id: req.barbershop!.id },
        include: { businessHours: { orderBy: { weekday: 'asc' } } },
      })
    })
    res.json({
      ...publicBarbershop(barbershop, true),
      membershipRole: req.membership?.role ?? null,
    })
  },
)

router.get('/current/holidays', resolveBarbershop, async (req, res) => {
  const { year } = z.object({ year: z.coerce.number().int().min(1).max(9999).optional() }).parse(req.query)
  const paddedYear = year?.toString().padStart(4, '0')
  const holidays = await prisma.holiday.findMany({
    where: {
      barbershopId: req.barbershop!.id,
      ...(paddedYear && {
        date: {
          gte: new Date(`${paddedYear}-01-01T00:00:00.000Z`),
          lt: new Date(`${String(year! + 1).padStart(4, '0')}-01-01T00:00:00.000Z`),
        },
      }),
    },
    orderBy: { date: 'asc' },
  })
  res.json(holidays.map(publicHoliday))
})

router.post(
  '/current/holidays',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN'),
  async (req, res) => {
    const input = holidayInputSchema.parse(req.body)
    try {
      const holiday = await prisma.holiday.create({
        data: {
          barbershopId: req.barbershop!.id,
          date: new Date(`${input.date}T00:00:00.000Z`),
          description: input.description,
        },
      })
      res.status(201).json(publicHoliday(holiday))
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        res.status(409).json({ message: 'Já existe um feriado cadastrado nesta data' })
        return
      }
      throw error
    }
  },
)

router.delete(
  '/current/holidays/:id',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN'),
  async (req, res) => {
    const id = holidayIdSchema.parse(req.params.id)
    const deleted = await prisma.holiday.deleteMany({
      where: { id, barbershopId: req.barbershop!.id },
    })
    if (deleted.count === 0) {
      res.status(404).json({ message: 'Feriado não encontrado' })
      return
    }
    res.status(204).end()
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
    remindersEnabled: barbershop.remindersEnabled,
    reminderHoursBefore: barbershop.reminderHoursBefore,
    monthlyFeeCents: barbershop.monthlyFeeCents,
    commissionBps: barbershop.commissionBps,
    businessHours: barbershop.businessHours.map((hour) => ({
      weekday: hour.weekday,
      opensAt: hour.opensAt,
      closesAt: hour.closesAt,
      breakStartsAt: hour.breakStartsAt,
      breakEndsAt: hour.breakEndsAt,
      enabled: hour.enabled,
    })),
    ...(staff ? {
      subscriptionStatus: barbershop.subscriptionStatus,
      mercadoPagoConnected: Boolean(barbershop.mercadoPagoSellerId),
    } : {}),
  }
}

const publicHoliday = (holiday: { id: string; date: Date; description: string }) => ({
  id: holiday.id,
  date: holiday.date.toISOString().slice(0, 10),
  description: holiday.description,
})

export { router as barbershopsRoutes }
