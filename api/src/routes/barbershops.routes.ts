import { Prisma } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { resolveBarbershop, requireBarbershopRole } from '../middleware/barbershop.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'
import { calculateCommissionCents } from '../domain/billing.js'
import { staffNotificationTypes } from '../lib/staff-notifications.js'
import { logoUrlField, timezoneField } from '../lib/settings-fields.js'
import { summarizeReviews } from '../lib/review-summary.js'
import { professionalLimit, subscriptionSnapshot, trialEndsAt } from '../domain/plans.js'
import {
  createInvitationToken,
  invitationAcceptUrl,
  invitationExpiresAt,
  invitationState,
} from '../lib/invitations.js'
import { mailer } from '../lib/mailer.js'
import { audit } from '../lib/audit.js'

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
const notificationPreferencesSchema = z.object({
  notificationTypes: z.array(z.enum(staffNotificationTypes))
    .max(staffNotificationTypes.length)
    .refine((types) => new Set(types).size === types.length, 'Tipos de aviso não podem se repetir'),
  dailySummaryTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
}).strict()

const defaultHours = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  opensAt: '09:00',
  closesAt: '20:00',
  enabled: weekday >= 2 && weekday <= 6,
}))

const slugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(60)
const planSchema = z.enum(['STARTER', 'PRO', 'SCALE'])

const settingsSchema = z.object({
  name: z.string().trim().min(3).max(80),
  logoUrl: logoUrlField.optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  address: z.union([z.string().trim().max(160), z.null()]).optional(),
  timezone: timezoneField,
  depositType: z.enum(['NONE', 'PERCENTAGE', 'FIXED', 'FULL']),
  depositValue: z.number().int().min(0),
  cancellationWindowHours: z.number().int().min(0).max(720),
  lateCancellationFeeBps: z.number().int().min(0).max(10_000),
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

/** Slug livre para o cadastro, com sugestão quando já está em uso. */
router.get('/slug-available', async (req, res, next) => {
  try {
    const slug = slugSchema.parse(req.query.slug)
    const taken = await prisma.barbershop.findUnique({ where: { slug }, select: { id: true } })
    res.json({
      slug,
      available: !taken,
      suggestion: taken ? `${slug.slice(0, 50)}-${Math.floor(Math.random() * 900 + 100)}` : null,
    })
  } catch (error) {
    next(error)
  }
})

router.post('/', requireUser, async (req, res, next) => {
  try {
    const user = req.user as SessionUser
    if (!user.platformAdmin && user.establishmentRequest !== 'APPROVED') {
      res.status(403).json({
        message: 'O cadastro de estabelecimento precisa ser autorizado pelo administrador',
        code: 'ESTABLISHMENT_NOT_APPROVED',
      })
      return
    }
    const input = z.object({
      name: z.string().trim().min(3).max(80),
      slug: slugSchema,
      address: z.string().trim().max(160).optional(),
      plan: planSchema.optional(),
    }).parse(req.body)

    const existing = await prisma.barbershop.findUnique({ where: { slug: input.slug }, select: { id: true } })
    if (existing) {
      res.status(409).json({ message: 'Este link já está em uso. Escolha outro identificador.', code: 'SLUG_TAKEN' })
      return
    }

    const owned = await prisma.membership.findMany({
      where: { userId: user.id, role: 'OWNER' },
      select: { barbershop: { select: { plan: true } } },
    })
    if (!user.platformAdmin && owned.length > 0) {
      const scaleUnits = owned.filter((item) => item.barbershop.plan === 'SCALE').length
      const allowedUnits = scaleUnits > 0 ? 5 : 1
      if (owned.length >= allowedUnits) {
        res.status(409).json({
          message: 'Sua conta já administra uma barbearia. O plano Escala permite até 5 unidades.',
          code: 'SHOP_LIMIT',
          upgradeTo: 'SCALE',
        })
        return
      }
    }

    const plan = input.plan === 'SCALE' ? 'SCALE' : input.plan === 'PRO' ? 'PRO' : 'STARTER'
    const trial = trialEndsAt()
    const barbershop = await prisma.$transaction(async (tx) => {
      const created = await tx.barbershop.create({
        data: {
          name: input.name,
          slug: input.slug,
          address: input.address || null,
          plan,
          monthlyFeeCents: plan === 'SCALE' ? 14_990 : plan === 'PRO' ? 8_990 : 4_990,
          subscriptionStatus: 'TRIALING',
          trialEndsAt: trial,
          billingEmail: user.email ?? null,
          businessHours: { create: defaultHours },
          memberships: { create: { userId: user.id, role: 'OWNER' } },
        },
        include: { businessHours: { orderBy: { weekday: 'asc' } } },
      })
      // A autorização vale por um cadastro: novos estabelecimentos pedem nova aprovação.
      await tx.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN', ...(user.platformAdmin ? {} : { establishmentRequest: 'NONE' as const }) },
      })
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          barbershopId: created.id,
          action: 'barbershop.created',
          target: created.id,
          metadata: { plan, trialEndsAt: trial.toISOString() },
        },
      })
      return created
    })
    res.status(201).json({
      ...publicBarbershop(barbershop, true),
      membershipRole: 'OWNER',
      subscription: subscriptionSnapshot(barbershop),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/current', resolveBarbershop, async (req, res) => {
  const user = req.user as SessionUser | undefined
  const membership = user ? await prisma.membership.findUnique({
    where: { barbershopId_userId: { barbershopId: req.barbershop!.id, userId: user.id } },
  }) : null
  const staff = Boolean(membership)
  res.json({
    ...publicBarbershop(req.barbershop!, staff),
    membershipRole: membership?.role ?? null,
    ...(staff ? {
      subscription: subscriptionSnapshot(req.barbershop!),
      limits: {
        professionals: Number.isFinite(professionalLimit(req.barbershop!.plan))
          ? professionalLimit(req.barbershop!.plan)
          : null,
        units: 5,
      },
      shareUrl: `${(process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/b/${req.barbershop!.slug}`,
      onboardingCompletedAt: req.barbershop!.onboardingCompletedAt?.toISOString() ?? null,
    } : {}),
  })
})

// Página pública da barbearia (sem login): serviços, equipe, horários e avaliações.
router.get('/current/profile', resolveBarbershop, async (req, res, next) => {
  try {
    const barbershopId = req.barbershop!.id
    const [services, team, ratings, latest, packages] = await Promise.all([
      prisma.service.findMany({ where: { barbershopId, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, duration: true, priceCents: true } }),
      prisma.user.findMany({
        where: { memberships: { some: { barbershopId, role: { in: ['OWNER', 'ADMIN', 'BARBER'] } } } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.review.findMany({ where: { barbershopId }, select: { rating: true } }),
      prisma.review.findMany({
        where: { barbershopId, comment: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, rating: true, comment: true, createdAt: true, user: { select: { name: true } } },
      }),
      prisma.servicePackage.findMany({ where: { barbershopId, active: true }, orderBy: { priceCents: 'asc' }, select: { id: true, name: true, sessions: true, priceCents: true, validityDays: true } }),
    ])
    res.json({
      barbershop: {
        slug: req.barbershop!.slug,
        name: req.barbershop!.name,
        logoUrl: req.barbershop!.logoUrl,
        primaryColor: req.barbershop!.primaryColor,
        address: req.barbershop!.address,
        timezone: req.barbershop!.timezone,
        businessHours: req.barbershop!.businessHours.map((hour) => ({
          weekday: hour.weekday, opensAt: hour.opensAt, closesAt: hour.closesAt,
          breakStartsAt: hour.breakStartsAt, breakEndsAt: hour.breakEndsAt, enabled: hour.enabled,
        })),
      },
      services: services.map((service) => ({ id: service.id, name: service.name, duration: service.duration, price: service.priceCents / 100 })),
      team: team.map((member) => ({ id: member.id, name: member.name, specialty: 'Cortes e barba' })),
      packages: packages.map((item) => ({ id: item.id, name: item.name, sessions: item.sessions, price: item.priceCents / 100, validityDays: item.validityDays })),
      rating: summarizeReviews(ratings.map((item) => item.rating)),
      reviews: latest.map((item) => ({
        id: item.id, rating: item.rating, comment: item.comment, createdAt: item.createdAt.toISOString(),
        customerName: item.user.name.split(' ')[0] ?? 'Cliente',
      })),
    })
  } catch (error) {
    next(error)
  }
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

router.get(
  '/current/notification-preferences',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'),
  async (req, res) => {
    const membership = await prisma.membership.findUniqueOrThrow({
      where: { id: req.membership!.id },
      include: { user: { select: { telegramId: true } } },
    })
    res.json(publicNotificationPreferences(membership))
  },
)

router.patch(
  '/current/notification-preferences',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'),
  async (req, res) => {
    const input = notificationPreferencesSchema.parse(req.body)
    const membership = await prisma.membership.update({
      where: { id: req.membership!.id },
      data: input,
      include: { user: { select: { telegramId: true } } },
    })
    res.json(publicNotificationPreferences(membership))
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

const invitationInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()).transform((value) => value.toLowerCase()),
  role: z.enum(['ADMIN', 'BARBER']).default('BARBER'),
})
const teamRoleSchema = z.object({ role: z.enum(['ADMIN', 'BARBER']) })
const memberIdSchema = z.string().uuid()

/** Visão da equipe para a tela de gestão de pessoas. */
router.get(
  '/current/team',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'),
  async (req, res, next) => {
    try {
      const now = new Date()
      const [memberships, invitations] = await Promise.all([
        prisma.membership.findMany({
          where: { barbershopId: req.barbershop!.id },
          include: { user: { select: { id: true, name: true, email: true, phone: true } } },
        }),
        prisma.invitation.findMany({
          where: { barbershopId: req.barbershop!.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
          orderBy: { createdAt: 'desc' },
        }),
      ])
      const rawLimit = professionalLimit(req.barbershop!.plan)
      const limit = Number.isFinite(rawLimit) ? rawLimit : null
      const used = memberships.length + invitations.length
      res.json({
        members: memberships
          .map((membership) => ({
            userId: membership.user.id,
            name: membership.user.name,
            email: membership.user.email,
            phone: membership.user.phone,
            role: membership.role,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        invitations: invitations.map((invitation) => ({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt.toISOString(),
          createdAt: invitation.createdAt.toISOString(),
          state: invitationState(invitation, now),
        })),
        limits: { professionals: limit, used, remaining: limit === null ? null : Math.max(0, limit - used) },
      })
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/current/invitations',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const input = invitationInputSchema.parse(req.body)
      const barbershop = req.barbershop!
      const user = req.user as SessionUser

      const alreadyMember = await prisma.user.findFirst({
        where: { email: input.email, memberships: { some: { barbershopId: barbershop.id } } },
        select: { id: true },
      })
      if (alreadyMember) {
        res.status(409).json({ message: 'Essa pessoa já faz parte da equipe', code: 'ALREADY_MEMBER' })
        return
      }
      const pending = await prisma.invitation.findFirst({
        where: {
          barbershopId: barbershop.id, email: input.email,
          acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() },
        },
      })
      if (pending) {
        res.status(409).json({
          message: 'Já existe um convite pendente para este e-mail. Reenvie ou cancele o anterior.',
          code: 'INVITATION_PENDING',
          invitationId: pending.id,
        })
        return
      }

      const [staffCount, pendingCount] = await Promise.all([
        prisma.membership.count({ where: { barbershopId: barbershop.id } }),
        prisma.invitation.count({
          where: { barbershopId: barbershop.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        }),
      ])
      const limit = professionalLimit(barbershop.plan)
      if (staffCount + pendingCount >= limit) {
        res.status(402).json({
          message: `Seu plano permite ${limit} profissional${limit === 1 ? '' : 'is'}. Faça upgrade para convidar mais gente.`,
          code: 'PLAN_LIMIT',
          limit,
          plan: barbershop.plan,
          upgradeTo: barbershop.plan === 'STARTER' ? 'PRO' : 'SCALE',
        })
        return
      }

      const { token, hash } = createInvitationToken()
      const expiresAt = invitationExpiresAt()
      const invitation = await prisma.invitation.create({
        data: {
          barbershopId: barbershop.id,
          email: input.email,
          role: input.role,
          tokenHash: hash,
          invitedById: user.id,
          expiresAt,
        },
      })
      const frontendUrl = process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:5173'
      const acceptUrl = invitationAcceptUrl(token, frontendUrl)
      const delivery = await mailer.send({
        to: input.email,
        subject: `${user.name} convidou você para ${barbershop.name}`,
        text: [
          `${user.name} convidou você para fazer parte da equipe de ${barbershop.name} no Meu Barbeiro.`,
          '',
          `Aceite pelo link: ${acceptUrl}`,
          '',
          `O convite expira em ${expiresAt.toLocaleDateString('pt-BR')}.`,
        ].join('\n'),
      })
      await audit({
        actorId: user.id,
        barbershopId: barbershop.id,
        action: 'invitation.created',
        target: invitation.id,
        metadata: { email: input.email, role: input.role, delivered: delivery.delivered },
      })
      res.status(201).json({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt.toISOString(),
        acceptUrl,
        emailDelivered: delivery.delivered,
        emailProvider: delivery.provider,
      })
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/current/invitations/:id/resend',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const id = memberIdSchema.parse(req.params.id)
      const barbershop = req.barbershop!
      const user = req.user as SessionUser
      const previous = await prisma.invitation.findFirst({
        where: { id, barbershopId: barbershop.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      })
      if (!previous) {
        res.status(404).json({ message: 'Convite pendente não encontrado', code: 'INVITATION_NOT_FOUND' })
        return
      }
      const { token, hash } = createInvitationToken()
      const expiresAt = invitationExpiresAt()
      await prisma.invitation.update({
        where: { id: previous.id },
        data: { tokenHash: hash, expiresAt, lastSentAt: new Date() },
      })
      const frontendUrl = process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:5173'
      const acceptUrl = invitationAcceptUrl(token, frontendUrl)
      const delivery = await mailer.send({
        to: previous.email,
        subject: `Convite para ${barbershop.name}`,
        text: `Seu convite para ${barbershop.name} foi reenviado.\n\nAceite pelo link: ${acceptUrl}`,
      })
      await audit({ actorId: user.id, barbershopId: barbershop.id, action: 'invitation.resent', target: previous.id })
      res.json({
        id: previous.id,
        email: previous.email,
        role: previous.role,
        expiresAt: expiresAt.toISOString(),
        acceptUrl,
        emailDelivered: delivery.delivered,
        emailProvider: delivery.provider,
      })
    } catch (error) {
      next(error)
    }
  },
)

router.delete(
  '/current/invitations/:id',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const id = memberIdSchema.parse(req.params.id)
      const revoked = await prisma.invitation.updateMany({
        where: { id, barbershopId: req.barbershop!.id, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      if (revoked.count === 0) {
        res.status(404).json({ message: 'Convite pendente não encontrado', code: 'INVITATION_NOT_FOUND' })
        return
      }
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  },
)

router.patch(
  '/current/team/:userId',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER'),
  async (req, res, next) => {
    try {
      const userId = memberIdSchema.parse(req.params.userId)
      const input = teamRoleSchema.parse(req.body)
      const membership = await prisma.membership.findUnique({
        where: { barbershopId_userId: { barbershopId: req.barbershop!.id, userId } },
      })
      if (!membership) {
        res.status(404).json({ message: 'Pessoa não encontrada na equipe', code: 'MEMBER_NOT_FOUND' })
        return
      }
      if (membership.role === 'OWNER') {
        res.status(409).json({ message: 'O papel de dono não pode ser alterado por aqui', code: 'OWNER_IMMUTABLE' })
        return
      }
      const updated = await prisma.membership.update({ where: { id: membership.id }, data: { role: input.role } })
      await audit({
        actorId: (req.user as SessionUser).id,
        barbershopId: req.barbershop!.id,
        action: 'membership.role-changed',
        target: userId,
        metadata: { from: membership.role, to: input.role },
      })
      res.json({ userId, role: updated.role })
    } catch (error) {
      next(error)
    }
  },
)

router.delete(
  '/current/team/:userId',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const userId = memberIdSchema.parse(req.params.userId)
      const actor = req.user as SessionUser
      const barbershop = req.barbershop!
      if (userId === actor.id) {
        res.status(409).json({ message: 'Você não pode remover a própria conta', code: 'CANNOT_REMOVE_SELF' })
        return
      }
      const membership = await prisma.membership.findUnique({
        where: { barbershopId_userId: { barbershopId: barbershop.id, userId } },
      })
      if (!membership) {
        res.status(404).json({ message: 'Pessoa não encontrada na equipe', code: 'MEMBER_NOT_FOUND' })
        return
      }
      if (membership.role === 'OWNER') {
        res.status(403).json({
          message: 'Só o dono pode sair da própria barbearia. Transfira a titularidade antes.',
          code: 'CANNOT_REMOVE_OWNER',
        })
        return
      }
      if (req.membership!.role === 'ADMIN' && membership.role !== 'BARBER') {
        res.status(403).json({ message: 'Administradores só podem remover barbeiros', code: 'INSUFFICIENT_ROLE' })
        return
      }
      const upcoming = await prisma.appointment.count({
        where: {
          barbershopId: barbershop.id,
          barberId: userId,
          scheduledAt: { gte: new Date() },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
      })
      if (upcoming > 0) {
        res.status(409).json({
          message: `Remarque ou cancele ${upcoming} atendimento${upcoming === 1 ? '' : 's'} futuro${upcoming === 1 ? '' : 's'} antes de remover esta pessoa.`,
          code: 'BARBER_HAS_APPOINTMENTS',
          count: upcoming,
        })
        return
      }
      await prisma.membership.delete({ where: { id: membership.id } })
      await audit({
        actorId: actor.id,
        barbershopId: barbershop.id,
        action: 'membership.removed',
        target: userId,
        metadata: { role: membership.role },
      })
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  },
)

/** Checklist de primeiros passos: o que falta para a barbearia começar a vender. */
router.get(
  '/current/onboarding',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'),
  async (req, res, next) => {
    try {
      const barbershop = req.barbershop!
      const now = new Date()
      const [services, staffCount, pendingInvites] = await Promise.all([
        prisma.service.count({ where: { barbershopId: barbershop.id, active: true } }),
        prisma.membership.count({ where: { barbershopId: barbershop.id } }),
        prisma.invitation.count({
          where: { barbershopId: barbershop.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
        }),
      ])
      const openHours = barbershop.businessHours.filter((hour) => hour.enabled).length
      const snapshot = subscriptionSnapshot(barbershop, now)
      const steps = [
        {
          id: 'profile', title: 'Complete o perfil da barbearia',
          description: 'Endereço, WhatsApp e horário de funcionamento são o que o cliente vê antes de marcar.',
          done: Boolean(barbershop.address) && openHours > 0, action: 'ajustes',
        },
        {
          id: 'services', title: 'Cadastre pelo menos um serviço',
          description: 'Preço e duração definem os horários disponíveis na página pública.',
          done: services > 0, action: 'ajustes',
        },
        {
          id: 'team', title: 'Convide sua equipe',
          description: 'Cada barbeiro tem a própria agenda e escala.',
          done: staffCount + pendingInvites >= 2, action: 'equipe',
        },
        {
          id: 'payments', title: 'Conecte o Mercado Pago',
          description: 'Receber sinal online reduz falta sem precisar cobrar na conversa.',
          done: Boolean(barbershop.mercadoPagoSellerId), action: 'assinatura',
        },
        {
          id: 'plan', title: 'Escolha um plano antes do teste acabar',
          description: `Seu teste vai até ${barbershop.trialEndsAt?.toLocaleDateString('pt-BR') ?? '—'}.`,
          done: snapshot.state === 'ACTIVE', action: 'assinatura',
        },
      ]
      const shareUrl = `${(process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/b/${barbershop.slug}`
      res.json({
        completed: barbershop.onboardingCompletedAt !== null || steps.every((step) => step.done),
        completedAt: barbershop.onboardingCompletedAt?.toISOString() ?? null,
        steps,
        completedCount: steps.filter((step) => step.done).length,
        totalSteps: steps.length,
        shareUrl,
        subscription: snapshot,
      })
    } catch (error) {
      next(error)
    }
  },
)

router.patch(
  '/current/onboarding/complete',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const updated = await prisma.barbershop.update({
        where: { id: req.barbershop!.id },
        data: { onboardingCompletedAt: new Date() },
        select: { onboardingCompletedAt: true },
      })
      res.json({ completedAt: updated.onboardingCompletedAt?.toISOString() ?? null })
    } catch (error) {
      next(error)
    }
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
    cancellationWindowHours: barbershop.cancellationWindowHours,
    lateCancellationFeeBps: barbershop.lateCancellationFeeBps,
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
      plan: barbershop.plan,
      trialEndsAt: barbershop.trialEndsAt?.toISOString() ?? null,
      mercadoPagoConnected: Boolean(barbershop.mercadoPagoSellerId),
    } : {}),
  }
}

const publicHoliday = (holiday: { id: string; date: Date; description: string }) => ({
  id: holiday.id,
  date: holiday.date.toISOString().slice(0, 10),
  description: holiday.description,
})

const publicNotificationPreferences = (membership: {
  notificationTypes: string[]
  dailySummaryTime: string
  user: { telegramId: string | null }
}) => ({
  notificationTypes: membership.notificationTypes,
  dailySummaryTime: membership.dailySummaryTime,
  telegramLinked: Boolean(membership.user.telegramId),
})

export { router as barbershopsRoutes }
