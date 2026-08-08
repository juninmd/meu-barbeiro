import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { availabilitySlots, dateAtLocalTime, validateAppointmentSchedule } from '../lib/schedule.js'
import { fitNow, scheduleWalkInQueue } from '../lib/walk-in-queue.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'
import { requireBarbershopRole, resolveBarbershop } from '../middleware/barbershop.js'
import { enqueueStaffAppointmentNotification } from '../services/appointment-reminders.service.js'

const queueRouter = Router()
const fitRouter = Router()
const staffRoles = ['OWNER', 'ADMIN', 'BARBER'] as const

class QueueConflictError extends Error {}

queueRouter.use(requireUser, resolveBarbershop)

const serviceIdsSchema = z.array(z.string().uuid()).min(1).max(10).refine(
  (ids) => new Set(ids).size === ids.length,
  'Não repita o mesmo serviço',
)

const parseServiceIds = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : [value]
  return serviceIdsSchema.parse(values.flatMap((item) => typeof item === 'string' ? item.split(',') : []))
}

const localDate = (date: Date, timezone: string) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

const nextDate = (date: string) => {
  const value = new Date(`${date}T12:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

async function loadDayContext(barbershop: NonNullable<Express.Request['barbershop']>, now: Date) {
  const date = localDate(now, barbershop.timezone)
  const dayStart = dateAtLocalTime(date, '00:00', barbershop.timezone)
  const dayEnd = dateAtLocalTime(nextDate(date), '00:00', barbershop.timezone)
  const [barbers, services, appointments, holidays, schedules, absences, entries] = await Promise.all([
    prisma.user.findMany({
      where: { memberships: { some: { barbershopId: barbershop.id, role: { in: [...staffRoles] } } } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.service.findMany({ where: { barbershopId: barbershop.id } }),
    prisma.appointment.findMany({
      where: {
        barbershopId: barbershop.id,
        scheduledAt: { gte: dayStart, lt: dayEnd },
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [{ paymentStatus: { not: 'PENDING' } }, { paymentExpiresAt: { gt: now } }],
      },
      include: { service: true },
      orderBy: { scheduledAt: 'asc' },
    }),
    prisma.holiday.findMany({ where: { barbershopId: barbershop.id }, select: { date: true, description: true } }),
    prisma.barberSchedule.findMany({ where: { barbershopId: barbershop.id } }),
    prisma.barberAbsence.findMany({
      where: { barbershopId: barbershop.id, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
    }),
    prisma.walkInQueue.findMany({
      where: { barbershopId: barbershop.id, arrivedAt: { gte: dayStart, lt: dayEnd } },
      include: { user: { select: { id: true, name: true } }, barber: { select: { id: true, name: true } } },
      orderBy: [{ arrivedAt: 'asc' }, { id: 'asc' }],
    }),
  ])
  const serviceById = new Map(services.map((service) => [service.id, service]))
  const isAvailable = (barberId: string, startsAt: Date, duration: number) => validateAppointmentSchedule({
    scheduledAt: startsAt,
    duration,
    timezone: barbershop.timezone,
    businessHours: barbershop.businessHours,
    holidays,
    barberSchedule: schedules.filter((item) => item.barberId === barberId),
    absences: absences.filter((item) => item.barberId === barberId),
    scheduled: appointments.filter((item) => item.barberId === barberId).map((item) => ({
      id: item.id,
      scheduledAt: item.scheduledAt,
      duration: item.service.duration,
    })),
    now: new Date(now.getTime() - 1),
  }) === null
  const waiting = entries.filter((entry) => entry.status === 'WAITING')
  const estimates = scheduleWalkInQueue({
    now,
    endOfDay: dayEnd,
    barberIds: barbers.map((barber) => barber.id),
    entries: waiting.map((entry) => ({
      id: entry.id,
      arrivedAt: entry.arrivedAt,
      duration: entry.serviceIds.reduce((total, id) => total + (serviceById.get(id)?.duration ?? 0), 0),
      barberId: entry.barberId,
    })),
    isAvailable,
  })
  return { barbers, services, appointments, holidays, schedules, absences, entries, serviceById, estimates, date, dayEnd, isAvailable }
}

const publicQueue = (context: Awaited<ReturnType<typeof loadDayContext>>) => {
  const estimateById = new Map(context.estimates.map((estimate) => [estimate.id, estimate]))
  const barberById = new Map(context.barbers.map((barber) => [barber.id, barber]))
  return context.entries.map((entry) => {
    const estimate = estimateById.get(entry.id)
    return {
      id: entry.id,
      userId: entry.userId,
      guestName: entry.guestName,
      name: entry.user?.name ?? entry.guestName,
      serviceIds: entry.serviceIds,
      services: entry.serviceIds.flatMap((id) => {
        const service = context.serviceById.get(id)
        return service ? [{ id: service.id, name: service.name, duration: service.duration, price: service.priceCents / 100 }] : []
      }),
      barberId: entry.barberId,
      barber: entry.barber,
      assignedBarber: estimate?.assignedBarberId ? barberById.get(estimate.assignedBarberId) ?? null : null,
      status: entry.status,
      arrivedAt: entry.arrivedAt,
      calledAt: entry.calledAt,
      finishedAt: entry.finishedAt,
      position: estimate?.position ?? null,
      estimatedMinutes: estimate?.estimatedMinutes ?? null,
      estimatedStartAt: estimate?.startsAt ?? null,
      createdAt: entry.createdAt,
    }
  })
}

fitRouter.get('/fit-now', requireUser, resolveBarbershop, requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'), async (req, res) => {
  const serviceIds = parseServiceIds(req.query.serviceIds ?? req.query['serviceIds[]'])
  const barberId = z.string().uuid().optional().parse(req.query.barberId)
  const barbershop = req.barbershop!
  const now = new Date()
  const context = await loadDayContext(barbershop, now)
  const services = serviceIds.map((id) => context.serviceById.get(id)).filter((service) => service?.active)
  if (services.length !== serviceIds.length) {
    res.status(400).json({ message: 'Serviço inválido ou inativo' })
    return
  }
  const selectedBarbers = barberId ? context.barbers.filter((barber) => barber.id === barberId) : context.barbers
  if (selectedBarbers.length === 0) {
    res.status(400).json({ message: 'Barbeiro inválido' })
    return
  }
  const duration = services.reduce((total, service) => total + (service?.duration ?? 0), 0)
  res.json({
    serviceIds,
    duration,
    checkedAt: now,
    timezone: barbershop.timezone,
    barbers: selectedBarbers.map((barber) => {
      const current = context.appointments.find((appointment) => (
        appointment.barberId === barber.id
        && appointment.status === 'CONFIRMED'
        && appointment.scheduledAt <= now
        && appointment.scheduledAt.getTime() + appointment.service.duration * 60_000 > now.getTime()
      ))
      const availableSlots = availabilitySlots({
        date: context.date,
        duration,
        timezone: barbershop.timezone,
        businessHours: barbershop.businessHours,
        holidays: context.holidays,
        barberSchedule: context.schedules.filter((item) => item.barberId === barber.id),
        absences: context.absences.filter((item) => item.barberId === barber.id),
        scheduled: context.appointments.filter((item) => item.barberId === barber.id).map((item) => ({
          scheduledAt: item.scheduledAt,
          duration: item.service.duration,
        })),
        now,
      })
      const slotTimestamps = new Set(availableSlots.slots.map((slot) => slot.scheduledAt.getTime()))
      const result = fitNow({
        now,
        duration,
        endOfDay: context.dayEnd,
        currentServiceEndsAt: current
          ? new Date(current.scheduledAt.getTime() + current.service.duration * 60_000)
          : null,
        isAvailable: (startsAt, requestedDuration) => startsAt.getTime() === now.getTime()
          ? context.isAvailable(barber.id, startsAt, requestedDuration)
          : slotTimestamps.has(startsAt.getTime()),
      })
      return { barber, ...result }
    }),
  })
})

queueRouter.post('/', requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'), async (req, res) => {
  const input = z.object({
    userId: z.string().uuid().optional(),
    guestName: z.string().trim().min(2).max(80).optional(),
    serviceIds: serviceIdsSchema,
    barberId: z.string().uuid().nullable().optional(),
  }).strict().refine((value) => Boolean(value.userId) !== Boolean(value.guestName), {
    message: 'Informe um cliente cadastrado ou o nome do visitante',
  }).parse(req.body)
  const barbershop = req.barbershop!
  const user = req.user as SessionUser
  if (req.membership!.role === 'BARBER' && input.barberId && input.barberId !== user.id) {
    res.status(403).json({ message: 'Barbeiros só podem usar a própria agenda como preferência' })
    return
  }
  const [services, preferredBarber, customer] = await Promise.all([
    prisma.service.findMany({ where: { id: { in: input.serviceIds }, barbershopId: barbershop.id, active: true } }),
    input.barberId ? prisma.user.findFirst({
      where: { id: input.barberId, memberships: { some: { barbershopId: barbershop.id, role: { in: [...staffRoles] } } } },
    }) : Promise.resolve(null),
    input.userId ? prisma.user.findFirst({ where: { id: input.userId, role: 'CUSTOMER' } }) : Promise.resolve(null),
  ])
  if (services.length !== input.serviceIds.length) {
    res.status(400).json({ message: 'Serviço inválido ou inativo' })
    return
  }
  if (input.barberId && !preferredBarber) {
    res.status(400).json({ message: 'Barbeiro inválido' })
    return
  }
  if (input.userId && !customer) {
    res.status(400).json({ message: 'Cliente inválido' })
    return
  }
  const created = await prisma.walkInQueue.create({
    data: {
      barbershopId: barbershop.id,
      userId: input.userId ?? null,
      guestName: input.guestName ?? null,
      serviceIds: input.serviceIds,
      barberId: input.barberId ?? null,
    },
  })
  const context = await loadDayContext(barbershop, new Date())
  const item = publicQueue(context).find((entry) => entry.id === created.id)!
  await prisma.walkInQueue.update({ where: { id: created.id }, data: { estimatedMinutes: item.estimatedMinutes } })
  res.status(201).json(item)
})

queueRouter.get('/', async (req, res) => {
  const user = req.user as SessionUser
  if (user.role !== 'CUSTOMER') {
    const membership = await prisma.membership.findUnique({
      where: { barbershopId_userId: { barbershopId: req.barbershop!.id, userId: user.id } },
    })
    if (!membership) {
      res.status(403).json({ message: 'Acesso negado para esta barbearia' })
      return
    }
  }
  const context = await loadDayContext(req.barbershop!, new Date())
  const entries = publicQueue(context)
  res.json(user.role === 'CUSTOMER' ? entries.filter((entry) => entry.userId === user.id) : entries)
})

queueRouter.post('/:id/call', requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'), async (req, res) => {
  const id = z.string().uuid().parse(req.params.id)
  const input = z.object({ barberId: z.string().uuid().optional() }).strict().parse(req.body ?? {})
  const barbershop = req.barbershop!
  if (barbershop.subscriptionStatus !== 'ACTIVE') {
    res.status(402).json({ message: 'Agendamentos temporariamente indisponíveis: assinatura da barbearia inativa' })
    return
  }
  const now = new Date()
  const context = await loadDayContext(barbershop, now)
  const entry = context.entries.find((item) => item.id === id)
  const estimate = context.estimates.find((item) => item.id === id)
  if (!entry) {
    res.status(404).json({ message: 'Pessoa não encontrada na fila de hoje' })
    return
  }
  if (entry.status !== 'WAITING') {
    res.status(409).json({ message: 'Esta pessoa não está mais aguardando' })
    return
  }
  const barberId = input.barberId ?? entry.barberId ?? estimate?.assignedBarberId
  const user = req.user as SessionUser
  if (!barberId || estimate?.assignedBarberId !== barberId || estimate.estimatedMinutes !== 0) {
    res.status(409).json({ message: estimate?.estimatedMinutes == null ? 'Não há encaixe disponível hoje' : `Aguarde aproximadamente ${estimate.estimatedMinutes} min` })
    return
  }
  if (req.membership!.role === 'BARBER' && barberId !== user.id) {
    res.status(403).json({ message: 'Barbeiros só podem chamar para a própria cadeira' })
    return
  }
  const orderedServices = entry.serviceIds.map((serviceId) => context.serviceById.get(serviceId)).filter((service) => service?.active)
  if (orderedServices.length !== entry.serviceIds.length) {
    res.status(409).json({ message: 'Um dos serviços da fila não está mais disponível' })
    return
  }
  const totalDuration = orderedServices.reduce((total, service) => total + (service?.duration ?? 0), 0)
  const transaction = prisma.$transaction(async (tx) => {
    const latest = await tx.walkInQueue.findFirst({ where: { id, barbershopId: barbershop.id, status: 'WAITING' } })
    if (!latest) throw new QueueConflictError('Esta pessoa não está mais aguardando')
    const scheduled = await tx.appointment.findMany({
      where: {
        barbershopId: barbershop.id,
        barberId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [{ paymentStatus: { not: 'PENDING' } }, { paymentExpiresAt: { gt: now } }],
      },
      include: { service: true },
    })
    const scheduleError = validateAppointmentSchedule({
      scheduledAt: now,
      duration: totalDuration,
      timezone: barbershop.timezone,
      businessHours: barbershop.businessHours,
      holidays: context.holidays,
      barberSchedule: context.schedules.filter((item) => item.barberId === barberId),
      absences: context.absences.filter((item) => item.barberId === barberId),
      scheduled: scheduled.map((item) => ({ scheduledAt: item.scheduledAt, duration: item.service.duration })),
      now: new Date(now.getTime() - 1),
    })
    if (scheduleError) throw new QueueConflictError(scheduleError.message)
    const customer = latest.userId
      ? await tx.user.findUnique({ where: { id: latest.userId } })
      : await tx.user.create({ data: { name: latest.guestName!, role: 'CUSTOMER', email: null, googleId: null } })
    if (!customer) throw new QueueConflictError('Cliente inválido')
    let offsetMinutes = 0
    const created = []
    for (const service of orderedServices) {
      if (!service) continue
      created.push(await tx.appointment.create({
        data: {
          barbershopId: barbershop.id,
          userId: customer.id,
          barberId,
          serviceId: service.id,
          scheduledAt: new Date(now.getTime() + offsetMinutes * 60_000),
          status: 'CONFIRMED',
          paymentStatus: 'NOT_REQUIRED',
          paymentAmountCents: 0,
          commissionCents: 0,
          paymentExpiresAt: null,
          walkInQueueId: id,
        },
        include: { user: true, barber: true, service: true },
      }))
      offsetMinutes += service.duration
    }
    await tx.walkInQueue.update({
      where: { id },
      data: { status: 'IN_SERVICE', calledAt: now, userId: customer.id, barberId, estimatedMinutes: 0 },
    })
    return created
  }, { isolationLevel: 'Serializable' })
  let appointments: Awaited<typeof transaction>
  try {
    appointments = await transaction
  } catch (error) {
    if (error instanceof QueueConflictError) {
      res.status(409).json({ message: error.message })
      return
    }
    throw error
  }
  for (const appointment of appointments) {
    try {
      await enqueueStaffAppointmentNotification({
        type: 'NEW_APPOINTMENT',
        actorId: user.id,
        appointmentId: appointment.id,
        barberId: appointment.barberId,
        barbershopId: barbershop.id,
        barbershopName: barbershop.name,
        timezone: barbershop.timezone,
        customerName: appointment.user.name,
        serviceName: appointment.service.name,
        scheduledAt: appointment.scheduledAt,
      })
    } catch (error) {
      console.error('Falha ao enfileirar aviso de agenda', error)
    }
  }
  res.json({
    queueId: id,
    status: 'IN_SERVICE',
    calledAt: now,
    appointments: appointments.map((appointment) => ({
      id: appointment.id,
      userId: appointment.userId,
      barberId: appointment.barberId,
      serviceId: appointment.serviceId,
      scheduledAt: appointment.scheduledAt,
      status: appointment.status,
      user: appointment.user,
      barber: appointment.barber,
      service: { ...appointment.service, price: appointment.service.priceCents / 100 },
    })),
  })
})

queueRouter.post('/:id/give-up', async (req, res) => {
  const id = z.string().uuid().parse(req.params.id)
  const user = req.user as SessionUser
  const entry = await prisma.walkInQueue.findFirst({ where: { id, barbershopId: req.barbershop!.id } })
  if (!entry) {
    res.status(404).json({ message: 'Pessoa não encontrada na fila de hoje' })
    return
  }
  const membership = user.role === 'CUSTOMER' ? null : await prisma.membership.findUnique({
    where: { barbershopId_userId: { barbershopId: req.barbershop!.id, userId: user.id } },
  })
  if (user.role === 'CUSTOMER' ? entry.userId !== user.id : !membership) {
    res.status(403).json({ message: 'Ação não permitida' })
    return
  }
  const updated = await prisma.walkInQueue.updateMany({
    where: { id, barbershopId: req.barbershop!.id, status: 'WAITING' },
    data: { status: 'GAVE_UP' },
  })
  if (updated.count === 0) {
    res.status(409).json({ message: 'Esta pessoa não está mais aguardando' })
    return
  }
  res.json(await prisma.walkInQueue.findUnique({ where: { id } }))
})

export { fitRouter as appointmentsFitNowRoutes, queueRouter as walkInQueueRoutes }
