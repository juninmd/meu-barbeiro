import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { availabilitySlots, dateAtLocalTime, schedulesOverlap } from '../lib/schedule.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'
import { requireBarbershopRole, resolveBarbershop } from '../middleware/barbershop.js'

const router = Router()
const idSchema = z.string().uuid()
const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Horário deve estar no formato HH:MM')
const scheduleSchema = z.object({
  schedule: z.array(z.object({
    weekday: z.number().int().min(0).max(6),
    startsAt: timeSchema,
    endsAt: timeSchema,
    enabled: z.boolean(),
  }).refine((item) => item.startsAt < item.endsAt, {
    message: 'O início da escala deve ser anterior ao fim',
    path: ['endsAt'],
  })).max(7).refine((items) => new Set(items.map((item) => item.weekday)).size === items.length, {
    message: 'Cada dia da semana pode aparecer uma única vez',
  }),
})

router.use(requireUser, resolveBarbershop)

router.get('/', async (req, res) => {
  const input = z.object({ date: z.iso.date().optional() }).parse(req.query)
  const users = await prisma.user.findMany({
    where: {
      memberships: {
        some: { barbershopId: req.barbershop!.id, role: { in: ['OWNER', 'ADMIN', 'BARBER'] } },
      },
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  })
  const barbers = users.map((user) => ({ ...user, specialty: 'Cortes e barba' }))
  if (!input.date) {
    res.json(barbers)
    return
  }

  const date = input.date
  const serviceIds = parseServiceIds(req.query.serviceIds ?? req.query['serviceIds[]'])
  const rangeEnd = addDays(date, 61)
  const now = new Date()
  const [services, scheduled, holidays, schedules, absences] = await Promise.all([
    serviceIds.length > 0
      ? prisma.service.findMany({ where: { id: { in: serviceIds }, barbershopId: req.barbershop!.id, active: true } })
      : Promise.resolve([]),
    prisma.appointment.findMany({
      where: {
        barbershopId: req.barbershop!.id,
        scheduledAt: {
          gte: dateAtLocalTime(date, '00:00', req.barbershop!.timezone),
          lt: dateAtLocalTime(rangeEnd, '00:00', req.barbershop!.timezone),
        },
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [{ paymentStatus: { not: 'PENDING' } }, { paymentExpiresAt: { gt: now } }],
      },
      include: { service: true },
    }),
    prisma.holiday.findMany({
      where: {
        barbershopId: req.barbershop!.id,
        date: { gte: new Date(`${date}T00:00:00.000Z`), lt: new Date(`${rangeEnd}T00:00:00.000Z`) },
      },
      select: { date: true, description: true },
    }),
    prisma.barberSchedule.findMany({ where: { barbershopId: req.barbershop!.id } }),
    prisma.barberAbsence.findMany({
      where: {
        barbershopId: req.barbershop!.id,
        startsAt: { lt: dateAtLocalTime(rangeEnd, '00:00', req.barbershop!.timezone) },
        endsAt: { gt: dateAtLocalTime(date, '00:00', req.barbershop!.timezone) },
      },
    }),
  ])
  if (services.length !== serviceIds.length) {
    res.status(400).json({ message: 'Serviço inválido' })
    return
  }

  const duration = services.reduce((total, service) => total + service.duration, 0) || 15
  const availabilityFor = (barberId: string, date: string, options: { schedule?: boolean; absence?: boolean; appointments?: boolean } = {}) => availabilitySlots({
    date,
    duration,
    timezone: req.barbershop!.timezone,
    businessHours: req.barbershop!.businessHours,
    holidays,
    barberSchedule: options.schedule === false ? [] : schedules.filter((item) => item.barberId === barberId),
    absences: options.absence === false ? [] : absences.filter((item) => item.barberId === barberId),
    scheduled: options.appointments === false ? [] : scheduled.filter((item) => item.barberId === barberId).map((item) => ({
      scheduledAt: item.scheduledAt,
      duration: item.service.duration,
    })),
    now,
  })

  res.json(barbers.map((barber) => {
    const availability = availabilityFor(barber.id, date)
    if (availability.slots.length > 0) {
      return {
        ...barber,
        available: true,
        unavailableReason: null,
        slotCount: availability.slots.length,
        firstAvailableTime: availability.slots[0]!.label,
        nextAvailableDate: null,
      }
    }

    const withoutRestrictions = availabilityFor(barber.id, date, { schedule: false, absence: false, appointments: false })
    const withinSchedule = availabilityFor(barber.id, date, { absence: false, appointments: false })
    const withoutAppointments = availabilityFor(barber.id, date, { appointments: false })
    const unavailableReason = withoutRestrictions.slots.length === 0
      ? 'folga'
      : withinSchedule.slots.length === 0
        ? 'fora da escala'
        : withoutAppointments.slots.length === 0
          ? 'ausência'
          : 'agenda cheia'
    let nextAvailableDate: string | null = null
    for (let offset = 1; offset <= 60; offset += 1) {
      const candidate = addDays(date, offset)
      if (availabilityFor(barber.id, candidate).slots.length > 0) {
        nextAvailableDate = candidate
        break
      }
    }
    return {
      ...barber,
      available: false,
      unavailableReason,
      slotCount: 0,
      firstAvailableTime: null,
      nextAvailableDate,
    }
  }))
})

function parseServiceIds(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  return [...new Set(values.flatMap((item) => typeof item === 'string' ? item.split(',') : []).filter(Boolean).map((item) => idSchema.parse(item)))]
}

function addDays(date: string, days: number): string {
  const instant = new Date(`${date}T00:00:00.000Z`)
  instant.setUTCDate(instant.getUTCDate() + days)
  return instant.toISOString().slice(0, 10)
}

router.get('/:id/absences', requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'), async (req, res) => {
  const barberId = idSchema.parse(req.params.id)
  if (!await canManageBarber(req, res, barberId)) return
  const absences = await prisma.barberAbsence.findMany({
    where: { barbershopId: req.barbershop!.id, barberId, endsAt: { gt: new Date() } },
    orderBy: { startsAt: 'asc' },
  })
  res.json(absences)
})

router.post('/:id/absences', requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'), async (req, res) => {
  const barberId = idSchema.parse(req.params.id)
  if (!await canManageBarber(req, res, barberId)) return
  const input = z.object({
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    reason: z.string().trim().min(1).max(200),
  }).refine((item) => item.endsAt > item.startsAt, {
    message: 'O fim da ausência deve ser posterior ao início',
    path: ['endsAt'],
  }).parse(req.body)
  const now = new Date()
  const appointments = await prisma.appointment.findMany({
    where: {
      barbershopId: req.barbershop!.id,
      barberId,
      scheduledAt: { lt: input.endsAt },
      status: { in: ['PENDING', 'CONFIRMED'] },
      OR: [{ paymentStatus: { not: 'PENDING' } }, { paymentExpiresAt: { gt: now } }],
    },
    include: { service: true },
  })
  const conflicts = appointments.filter((appointment) => schedulesOverlap({
    scheduledAt: appointment.scheduledAt,
    duration: appointment.service.duration,
  }, {
    scheduledAt: input.startsAt,
    duration: (input.endsAt.getTime() - input.startsAt.getTime()) / 60_000,
  })).length
  if (conflicts > 0) {
    res.status(409).json({
      message: `${conflicts} atendimento${conflicts === 1 ? '' : 's'} conflita${conflicts === 1 ? '' : 'm'} com esta ausência`,
      conflicts,
    })
    return
  }
  const absence = await prisma.barberAbsence.create({
    data: { ...input, barbershopId: req.barbershop!.id, barberId },
  })
  res.status(201).json(absence)
})

router.delete('/:id/absences/:absenceId', requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'), async (req, res) => {
  const barberId = idSchema.parse(req.params.id)
  const absenceId = idSchema.parse(req.params.absenceId)
  if (!await canManageBarber(req, res, barberId)) return
  const deleted = await prisma.barberAbsence.deleteMany({
    where: { id: absenceId, barbershopId: req.barbershop!.id, barberId },
  })
  if (deleted.count === 0) {
    res.status(404).json({ message: 'Ausência não encontrada' })
    return
  }
  res.status(204).end()
})

router.get('/:id/schedule', requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'), async (req, res) => {
  const barberId = idSchema.parse(req.params.id)
  if (!await canManageBarber(req, res, barberId)) return
  const schedule = await prisma.barberSchedule.findMany({
    where: { barbershopId: req.barbershop!.id, barberId },
    orderBy: { weekday: 'asc' },
  })
  res.json(schedule)
})

router.put('/:id/schedule', requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'), async (req, res) => {
  const barberId = idSchema.parse(req.params.id)
  if (!await canManageBarber(req, res, barberId)) return
  const { schedule } = scheduleSchema.parse(req.body)
  const barbershopId = req.barbershop!.id
  await prisma.$transaction(async (tx) => {
    await tx.barberSchedule.deleteMany({ where: { barbershopId, barberId } })
    if (schedule.length > 0) {
      await tx.barberSchedule.createMany({
        data: schedule.map((item) => ({ ...item, barbershopId, barberId })),
      })
    }
  })
  const saved = await prisma.barberSchedule.findMany({
    where: { barbershopId, barberId },
    orderBy: { weekday: 'asc' },
  })
  res.json(saved)
})

async function canManageBarber(req: Request, res: Response, barberId: string): Promise<boolean> {
  const user = req.user as SessionUser
  if (req.membership!.role === 'BARBER' && barberId !== user.id) {
    res.status(403).json({ message: 'Barbeiros só podem alterar a própria disponibilidade' })
    return false
  }
  const barber = await prisma.membership.findFirst({
    where: { barbershopId: req.barbershop!.id, userId: barberId, role: { in: ['OWNER', 'ADMIN', 'BARBER'] } },
    select: { id: true },
  })
  if (!barber) {
    res.status(404).json({ message: 'Barbeiro não encontrado' })
    return false
  }
  return true
}

export { router as barbersRoutes }
