import { Router } from 'express'
import { z } from 'zod'
import { calculateCommissionCents, calculateDepositCents } from '../domain/billing.js'
import { mercadoPagoClient, sellerAccessToken } from '../lib/mercado-pago-config.js'
import { cancellationQuote, cancellationReasonError, type CancellationRole } from '../lib/cancellation-policy.js'
import { claimMembershipVisit, membershipBenefit, type MembershipVisitDatabase } from '../lib/customer-membership.js'
import { prisma } from '../lib/prisma.js'
import { availabilitySlots, dateAtLocalTime, validateAppointmentSchedule, validateRescheduleStatus } from '../lib/schedule.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'
import { requireBarbershopRole, resolveBarbershop } from '../middleware/barbershop.js'
import { enqueueStaffAppointmentNotification, type StaffAppointmentEvent } from '../services/appointment-reminders.service.js'

const router = Router()
const includeRelations = {
  user: true,
  barber: true,
  service: true,
  cancellation: true,
  reminders: { where: { kind: { in: ['24h', '2h'] as string[] } }, orderBy: { sentAt: 'asc' } },
} as const

router.use(requireUser, resolveBarbershop)

router.get('/membership-benefit', async (req, res) => {
  const user = req.user as SessionUser
  const serviceId = z.string().uuid().parse(req.query.serviceId)
  const subscription = await prisma.customerSubscription.findFirst({
    where: { barbershopId: req.barbershop!.id, userId: user.id }, include: { plan: true }, orderBy: { createdAt: 'desc' },
  })
  if (!subscription) { res.json({ covered: false, remainingVisits: 0 }); return }
  res.json(membershipBenefit(subscription, subscription.plan, serviceId, new Date()))
})

router.get('/customers', requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'), async (req, res) => {
  const input = z.object({ q: z.string().trim().max(80).optional() }).parse(req.query)
  const phone = input.q?.replace(/\D/g, '')
  const customers = await prisma.user.findMany({
    where: {
      role: 'CUSTOMER',
      appointments: { some: { barbershopId: req.barbershop!.id } },
      ...(input.q ? {
        OR: [
          { name: { contains: input.q, mode: 'insensitive' as const } },
          ...(phone ? [{ phone: { contains: phone } }] : []),
        ],
      } : {}),
    },
    select: { id: true, name: true, phone: true },
    orderBy: { name: 'asc' },
    take: 20,
  })
  const noShows = await customerNoShowCounts(req.barbershop!.id, customers.map((customer) => customer.id))
  res.json(customers.map((customer) => ({ ...customer, noShowCount: noShows.get(customer.id) ?? 0 })))
})

router.get('/', async (req, res) => {
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
  const where = user.role === 'CUSTOMER'
    ? { barbershopId: req.barbershop!.id, userId: user.id }
    : { barbershopId: req.barbershop!.id, barberId: user.id }
  const appointments = await prisma.appointment.findMany({
    where,
    include: includeRelations,
    orderBy: { scheduledAt: 'asc' },
  })
  const noShows = await customerNoShowCounts(req.barbershop!.id, appointments.map((appointment) => appointment.userId))
  res.json(appointments.map((appointment) => publicAppointment(appointment, noShows.get(appointment.userId) ?? 0)))
})

router.get('/last', async (req, res) => {
  const user = req.user as SessionUser
  if (user.role !== 'CUSTOMER') {
    res.status(403).json({ message: 'Apenas clientes podem repetir atendimentos' })
    return
  }
  const barbershopId = req.barbershop!.id
  const appointment = await prisma.appointment.findFirst({
    where: { barbershopId, userId: user.id, status: 'DONE' },
    include: { service: true, barber: true },
    orderBy: { scheduledAt: 'desc' },
  })
  if (!appointment) {
    res.json(null)
    return
  }
  const barberMembership = await prisma.membership.findUnique({
    where: { barbershopId_userId: { barbershopId, userId: appointment.barberId } },
  })
  const serviceAvailable = appointment.service.active
  const barberAvailable = Boolean(barberMembership && ['OWNER', 'ADMIN', 'BARBER'].includes(barberMembership.role))
  const unavailableReason = !serviceAvailable
    ? 'O serviço do último atendimento não está mais disponível. Escolha outro serviço.'
    : !barberAvailable
      ? 'O barbeiro do último atendimento não faz mais parte desta barbearia. Escolha outro profissional.'
      : null
  res.json({
    service: {
      id: appointment.service.id,
      name: appointment.service.name,
      duration: appointment.service.duration,
      price: appointment.service.priceCents / 100,
      active: appointment.service.active,
    },
    barber: {
      id: appointment.barber.id,
      name: appointment.barber.name,
      specialty: 'Cortes e barba',
      available: barberAvailable,
    },
    repeatable: serviceAvailable && barberAvailable,
    unavailableReason,
  })
})

router.get('/availability', async (req, res) => {
  const user = req.user as SessionUser
  const barbershop = req.barbershop!
  const input = z.object({
    barberId: z.union([z.literal('any'), z.string().uuid()]),
    serviceId: z.string().uuid(),
    date: z.iso.date(),
    appointmentId: z.string().uuid().optional(),
  }).parse(req.query)
  const now = new Date()

  if (input.barberId === 'any') {
    if (input.appointmentId) {
      res.status(400).json({ message: 'Escolha um barbeiro para remarcar este atendimento' })
      return
    }
    const [service, barbers, scheduled, holidays, schedules, absences] = await Promise.all([
      prisma.service.findFirst({ where: { id: input.serviceId, barbershopId: barbershop.id, active: true } }),
      prisma.user.findMany({
        where: { memberships: { some: { barbershopId: barbershop.id, role: { in: ['OWNER', 'ADMIN', 'BARBER'] } } } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.appointment.findMany({
        where: {
          barbershopId: barbershop.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          OR: [{ paymentStatus: { not: 'PENDING' } }, { paymentExpiresAt: { gt: now } }],
        },
        include: { service: true },
      }),
      prisma.holiday.findMany({ where: { barbershopId: barbershop.id }, select: { date: true, description: true } }),
      prisma.barberSchedule.findMany({ where: { barbershopId: barbershop.id } }),
      prisma.barberAbsence.findMany({ where: { barbershopId: barbershop.id, endsAt: { gt: now } } }),
    ])
    if (!service || barbers.length === 0) {
      res.status(400).json({ message: 'Serviço ou barbeiro inválido' })
      return
    }
    const slots = new Map<string, { scheduledAt: string; label: string; barbers: Array<{ id: string; name: string }> }>()
    let reason: string | null = null
    let open = false
    for (const barber of barbers) {
      const availability = availabilitySlots({
        date: input.date,
        duration: service.duration,
        timezone: barbershop.timezone,
        businessHours: barbershop.businessHours,
        holidays,
        barberSchedule: schedules.filter((item) => item.barberId === barber.id),
        absences: absences.filter((item) => item.barberId === barber.id),
        scheduled: scheduled.filter((item) => item.barberId === barber.id).map((item) => ({
          scheduledAt: item.scheduledAt,
          duration: item.service.duration,
        })),
        now,
      })
      open ||= availability.open
      reason ??= availability.reason
      for (const slot of availability.slots) {
        const scheduledAt = slot.scheduledAt.toISOString()
        const current = slots.get(scheduledAt)
        if (current) current.barbers.push(barber)
        else slots.set(scheduledAt, { scheduledAt, label: slot.label, barbers: [barber] })
      }
    }
    const availableSlots = [...slots.values()].sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))
    res.json({
      date: input.date,
      timezone: barbershop.timezone,
      open,
      reason: availableSlots.length > 0 ? null : reason || 'Não há horários livres nesta data',
      slots: availableSlots,
    })
    return
  }

  const [service, barber, scheduled, excludedAppointment, holidays, barberAvailability] = await Promise.all([
    prisma.service.findUnique({
      where: { barbershopId_id: { barbershopId: barbershop.id, id: input.serviceId } },
    }),
    prisma.user.findFirst({
      where: {
        id: input.barberId,
        memberships: { some: { barbershopId: barbershop.id, role: { in: ['OWNER', 'ADMIN', 'BARBER'] } } },
      },
    }),
    prisma.appointment.findMany({
      where: {
        barbershopId: barbershop.id,
        barberId: input.barberId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [
          { paymentStatus: { not: 'PENDING' } },
          { paymentExpiresAt: { gt: now } },
        ],
      },
      include: { service: true },
    }),
    input.appointmentId
      ? prisma.appointment.findFirst({
        where: {
          id: input.appointmentId,
          barbershopId: barbershop.id,
          barberId: input.barberId,
          serviceId: input.serviceId,
        },
      })
      : Promise.resolve(null),
    prisma.holiday.findMany({
      where: { barbershopId: barbershop.id },
      select: { date: true, description: true },
    }),
    loadBarberAvailability(barbershop.id, input.barberId),
  ])
  if (!service?.active || !barber) {
    res.status(400).json({ message: 'Serviço ou barbeiro inválido' })
    return
  }
  if (input.appointmentId) {
    const ownsAppointment = user.role === 'CUSTOMER'
      ? excludedAppointment?.userId === user.id
      : excludedAppointment?.barberId === user.id
    if (!ownsAppointment) {
      res.status(403).json({ message: 'Ação não permitida' })
      return
    }
  }

  const availability = availabilitySlots({
    date: input.date,
    duration: service.duration,
    timezone: barbershop.timezone,
    businessHours: barbershop.businessHours,
    holidays,
    barberSchedule: barberAvailability.schedule,
    absences: barberAvailability.absences,
    scheduled: scheduled.filter((item) => item.id !== input.appointmentId).map((item) => ({
      scheduledAt: item.scheduledAt,
      duration: item.service.duration,
    })),
    now,
  })
  res.json({
    date: input.date,
    timezone: barbershop.timezone,
    ...availability,
  })
})

router.get('/calendar', async (req, res) => {
  const user = req.user as SessionUser
  const barbershop = req.barbershop!
  const input = z.object({ from: z.iso.date(), to: z.iso.date() }).parse(req.query)
  const dates = calendarDates(input.from, input.to)
  if (!dates || dates.length > 62) {
    res.status(400).json({ message: 'O intervalo deve ter no máximo 62 dias' })
    return
  }

  const membership = await prisma.membership.findUnique({
    where: { barbershopId_userId: { barbershopId: barbershop.id, userId: user.id } },
  })
  if (!membership) {
    res.status(403).json({ message: 'Acesso negado para esta barbearia' })
    return
  }

  const [appointments, holidays, absences, barberSchedule] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        barbershopId: barbershop.id,
        scheduledAt: {
          gte: dateAtLocalTime(input.from, '00:00', barbershop.timezone),
          lt: dateAtLocalTime(nextDate(input.to), '00:00', barbershop.timezone),
        },
        ...(membership.role === 'BARBER' ? { barberId: user.id } : {}),
      },
      include: includeRelations,
      orderBy: { scheduledAt: 'asc' },
    }),
    prisma.holiday.findMany({
      where: {
        barbershopId: barbershop.id,
        date: { gte: new Date(`${input.from}T00:00:00.000Z`), lte: new Date(`${input.to}T00:00:00.000Z`) },
      },
      select: { date: true, description: true },
    }),
    prisma.barberAbsence.findMany({
      where: {
        barbershopId: barbershop.id,
        startsAt: { lt: dateAtLocalTime(nextDate(input.to), '00:00', barbershop.timezone) },
        endsAt: { gt: dateAtLocalTime(input.from, '00:00', barbershop.timezone) },
        ...(membership.role === 'BARBER' ? { barberId: user.id } : {}),
      },
      include: { barber: { select: { id: true, name: true } } },
      orderBy: { startsAt: 'asc' },
    }),
    membership.role === 'BARBER'
      ? prisma.barberSchedule.findMany({ where: { barbershopId: barbershop.id, barberId: user.id } })
      : Promise.resolve([]),
  ])

  const noShows = await customerNoShowCounts(barbershop.id, appointments.map((appointment) => appointment.userId))
  const appointmentsByDate = Map.groupBy(appointments, (appointment) => (
    dateInTimezone(appointment.scheduledAt, barbershop.timezone)
  ))
  const holidaysByDate = new Map(holidays.map((holiday) => [holiday.date.toISOString().slice(0, 10), holiday]))

  res.json({
    from: input.from,
    to: input.to,
    timezone: barbershop.timezone,
    days: dates.map((date) => {
      const holiday = holidaysByDate.get(date)
      const weekday = weekdayInTimezone(date, barbershop.timezone)
      const hours = barbershop.businessHours.find((item) => item.weekday === weekday)
      const barberHours = barberSchedule.find((item) => item.weekday === weekday)
      const open = !holiday && Boolean(hours?.enabled) && (barberSchedule.length === 0 || Boolean(barberHours?.enabled))
      const reason = holiday
        ? `Feriado: ${holiday.description}`
        : open ? null : barberSchedule.length > 0 && !barberHours?.enabled
          ? 'Este barbeiro não atende neste dia'
          : 'Fora do expediente'
      const dayStart = dateAtLocalTime(date, '00:00', barbershop.timezone)
      const dayEnd = dateAtLocalTime(nextDate(date), '00:00', barbershop.timezone)
      return {
        date,
        open,
        reason,
        hours: open && hours ? {
          opensAt: barberHours?.enabled && barberHours.startsAt > hours.opensAt ? barberHours.startsAt : hours.opensAt,
          closesAt: barberHours?.enabled && barberHours.endsAt < hours.closesAt ? barberHours.endsAt : hours.closesAt,
          breakStartsAt: hours.breakStartsAt,
          breakEndsAt: hours.breakEndsAt,
        } : null,
        absences: absences.filter((absence) => absence.startsAt < dayEnd && dayStart < absence.endsAt).map((absence) => ({
          id: absence.id,
          barberId: absence.barberId,
          barberName: absence.barber.name,
          startsAt: absence.startsAt,
          endsAt: absence.endsAt,
          reason: absence.reason,
        })),
        appointments: (appointmentsByDate.get(date) ?? []).map((appointment) => ({
          ...publicAppointment(appointment, noShows.get(appointment.userId) ?? 0),
          time: new Intl.DateTimeFormat('pt-BR', {
            timeZone: barbershop.timezone,
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
          }).format(appointment.scheduledAt),
        })),
      }
    }),
  })
})

router.post('/', async (req, res) => {
  const user = req.user as SessionUser
  const barbershop = req.barbershop!
  if (user.role !== 'CUSTOMER') {
    res.status(403).json({ message: 'Apenas clientes podem solicitar horários' })
    return
  }
  if (barbershop.subscriptionStatus !== 'ACTIVE') {
    res.status(402).json({ message: 'Agendamentos temporariamente indisponíveis: assinatura da barbearia inativa' })
    return
  }

  const input = z.object({
    barberId: z.union([z.literal('any'), z.string().uuid()]),
    serviceId: z.string().uuid(),
    scheduledAt: z.coerce.date(),
  }).parse(req.body)

  const barberId = input.barberId === 'any'
    ? await selectAvailableBarber(barbershop, input.serviceId, input.scheduledAt)
    : input.barberId
  if (!barberId) {
    res.status(409).json({ message: 'Este horário acabou de ser reservado' })
    return
  }
  const appointmentInput = { ...input, barberId }

  const [service, barber, scheduled, holidays, barberAvailability] = await Promise.all([
    prisma.service.findUnique({
      where: { barbershopId_id: { barbershopId: barbershop.id, id: input.serviceId } },
    }),
    prisma.user.findFirst({
      where: {
        id: appointmentInput.barberId,
        memberships: { some: { barbershopId: barbershop.id, role: { in: ['OWNER', 'ADMIN', 'BARBER'] } } },
      },
    }),
    prisma.appointment.findMany({
      where: {
        barbershopId: barbershop.id,
        barberId: appointmentInput.barberId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [
          { paymentStatus: { not: 'PENDING' } },
          { paymentExpiresAt: { gt: new Date() } },
        ],
      },
      include: { service: true },
    }),
    prisma.holiday.findMany({
      where: { barbershopId: barbershop.id },
      select: { date: true, description: true },
    }),
    loadBarberAvailability(barbershop.id, appointmentInput.barberId),
  ])
  if (!service?.active || !barber) {
    res.status(400).json({ message: 'Serviço ou barbeiro inválido' })
    return
  }
  const scheduleError = validateAppointmentSchedule({
    scheduledAt: input.scheduledAt,
    duration: service.duration,
    timezone: barbershop.timezone,
    businessHours: barbershop.businessHours,
    holidays,
    barberSchedule: barberAvailability.schedule,
    absences: barberAvailability.absences,
    scheduled: scheduled.map((item) => ({
      id: item.id,
      scheduledAt: item.scheduledAt,
      duration: item.service.duration,
    })),
  })
  if (scheduleError) {
    res.status(scheduleError.code === 'conflict' ? 409 : 400).json({ message: scheduleError.message })
    return
  }

  const membershipVisit = await claimMembershipVisit({
    database: membershipVisitDatabase, barbershopId: barbershop.id, userId: user.id, serviceId: service.id, now: new Date(),
  })
  const depositPolicy = { type: barbershop.depositType, value: barbershop.depositValue }
  const paymentAmountCents = membershipVisit.covered ? 0 : calculateDepositCents(service.priceCents, depositPolicy)
  const commissionCents = paymentAmountCents > 0
    ? calculateCommissionCents(service.priceCents, barbershop.commissionBps)
    : 0
  if (paymentAmountCents > 0 && !barbershop.mercadoPagoSellerId) {
    res.status(409).json({ message: 'Pagamento online ainda não foi conectado pela barbearia' })
    return
  }

  const paymentExpiresAt = paymentAmountCents > 0 ? new Date(Date.now() + 15 * 60_000) : null
  const appointment = await prisma.appointment.create({
    data: {
      ...appointmentInput,
      barbershopId: barbershop.id,
      userId: user.id,
      ...(membershipVisit.covered ? { customerSubscriptionId: membershipVisit.subscriptionId } : {}),
      paymentStatus: paymentAmountCents > 0 ? 'PENDING' : 'NOT_REQUIRED',
      paymentAmountCents,
      commissionCents,
      paymentExpiresAt,
    },
    include: includeRelations,
  })

  let checkoutUrl: string | null = null
  if (paymentAmountCents > 0) {
    try {
      const checkout = await mercadoPagoClient().createMarketplaceCheckout({
        sellerAccessToken: await sellerAccessToken(barbershop),
        appointmentId: appointment.id,
        serviceName: service.name,
        servicePriceCents: service.priceCents,
        depositPolicy,
        ...(user.email ? { payerEmail: user.email } : {}),
        frontendBaseUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
        webhookUrl: `${process.env.API_PUBLIC_URL || 'http://localhost:3333'}/billing/mercado-pago/webhook`,
        ...(paymentExpiresAt ? { expiresAt: paymentExpiresAt } : {}),
      })
      checkoutUrl = checkout.initPoint
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { mercadoPagoPreferenceId: checkout.id },
      })
    } catch (error) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { paymentStatus: 'REJECTED' },
      })
      throw error
    }
  }

  await queueStaffNotificationSafely({
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

  res.status(201).json({ appointment: publicAppointment(appointment), checkoutUrl })
})

const walkInInputSchema = z.object({
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  scheduledAt: z.coerce.date(),
}).and(z.union([
  z.object({ userId: z.string().uuid() }),
  z.object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().max(30).optional() }),
  z.object({ customer: z.object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().max(30).optional() }).strict() }),
]))

router.post('/walk-in', requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'), async (req, res) => {
  const user = req.user as SessionUser
  const barbershop = req.barbershop!
  if (barbershop.subscriptionStatus !== 'ACTIVE') {
    res.status(402).json({ message: 'Agendamentos temporariamente indisponíveis: assinatura da barbearia inativa' })
    return
  }
  const input = walkInInputSchema.parse(req.body)
  if (req.membership!.role === 'BARBER' && input.barberId !== user.id) {
    res.status(403).json({ message: 'Barbeiros só podem lançar horários na própria agenda' })
    return
  }

  const [service, barber, scheduled, holidays, barberAvailability] = await Promise.all([
    prisma.service.findUnique({ where: { barbershopId_id: { barbershopId: barbershop.id, id: input.serviceId } } }),
    prisma.user.findFirst({
      where: {
        id: input.barberId,
        memberships: { some: { barbershopId: barbershop.id, role: { in: ['OWNER', 'ADMIN', 'BARBER'] } } },
      },
    }),
    prisma.appointment.findMany({
      where: {
        barbershopId: barbershop.id,
        barberId: input.barberId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [{ paymentStatus: { not: 'PENDING' } }, { paymentExpiresAt: { gt: new Date() } }],
      },
      include: { service: true },
    }),
    prisma.holiday.findMany({ where: { barbershopId: barbershop.id }, select: { date: true, description: true } }),
    loadBarberAvailability(barbershop.id, input.barberId),
  ])
  if (!service || !barber) {
    res.status(400).json({ message: 'Serviço ou barbeiro inválido' })
    return
  }
  const scheduleError = validateAppointmentSchedule({
    scheduledAt: input.scheduledAt,
    duration: service.duration,
    timezone: barbershop.timezone,
    businessHours: barbershop.businessHours,
    holidays,
    barberSchedule: barberAvailability.schedule,
    absences: barberAvailability.absences,
    scheduled: scheduled.map((item) => ({ id: item.id, scheduledAt: item.scheduledAt, duration: item.service.duration })),
  })
  if (scheduleError) {
    res.status(scheduleError.code === 'conflict' ? 409 : 400).json({ message: scheduleError.message })
    return
  }

  const identification = 'customer' in input ? input.customer : input
  let customer
  if ('userId' in identification) {
    customer = await prisma.user.findFirst({ where: { id: identification.userId, role: 'CUSTOMER' } })
    if (!customer) {
      res.status(400).json({ message: 'Cliente inválido' })
      return
    }
  } else {
    const phone = identification.phone?.replace(/\D/g, '') || null
    if (identification.phone && (!phone || phone.length < 8 || phone.length > 15)) {
      res.status(400).json({ message: 'Telefone inválido' })
      return
    }
    customer = phone ? await prisma.user.findUnique({ where: { phone } }) : null
    if (customer && customer.role !== 'CUSTOMER') {
      res.status(409).json({ message: 'Telefone já pertence a um usuário da barbearia' })
      return
    }
    customer ??= await prisma.user.create({
      data: { name: identification.name, phone, role: 'CUSTOMER', email: null, googleId: null },
    })
  }

  const appointment = await prisma.appointment.create({
    data: {
      barbershopId: barbershop.id,
      userId: customer.id,
      barberId: input.barberId,
      serviceId: input.serviceId,
      scheduledAt: input.scheduledAt,
      status: 'CONFIRMED',
      paymentStatus: 'NOT_REQUIRED',
      paymentAmountCents: 0,
      commissionCents: 0,
      paymentExpiresAt: null,
    },
    include: includeRelations,
  })
  await queueStaffNotificationSafely({
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
  res.status(201).json({ appointment: publicAppointment(appointment), checkoutUrl: null })
})

router.get('/:id/cancellation-preview', async (req, res) => {
  const user = req.user as SessionUser
  const barbershop = req.barbershop!
  const id = z.string().uuid().parse(req.params.id)
  const appointment = await prisma.appointment.findFirst({ where: { id, barbershopId: barbershop.id } })
  if (!appointment) {
    res.status(404).json({ message: 'Agendamento não encontrado' })
    return
  }
  const membership = user.role === 'CUSTOMER' ? null : await prisma.membership.findUnique({
    where: { barbershopId_userId: { barbershopId: barbershop.id, userId: user.id } },
  })
  const allowed = user.role === 'CUSTOMER'
    ? appointment.userId === user.id
    : Boolean(membership && (membership.role !== 'BARBER' || appointment.barberId === user.id))
  if (!allowed) {
    res.status(403).json({ message: 'Ação não permitida' })
    return
  }
  res.json(cancellationQuote({
    scheduledAt: appointment.scheduledAt,
    cancelledAt: new Date(),
    cancellationWindowHours: barbershop.cancellationWindowHours,
    lateCancellationFeeBps: barbershop.lateCancellationFeeBps,
    paidDepositCents: appointment.paymentStatus === 'APPROVED' ? appointment.paymentAmountCents : 0,
    cancelledByRole: cancellationRole(user, membership?.role),
  }))
})

router.patch('/:id', async (req, res) => {
  const user = req.user as SessionUser
  const barbershop = req.barbershop!
  const id = z.string().uuid().parse(req.params.id)
  const input = z.union([
    z.object({ status: z.enum(['CONFIRMED', 'DONE', 'NO_SHOW']) }).strict(),
    z.object({ status: z.literal('CANCELLED'), reason: z.string().trim().max(500).optional() }).strict(),
    z.object({ scheduledAt: z.coerce.date() }).strict(),
  ]).parse(req.body)

  const appointment = await prisma.appointment.findFirst({
    where: { id, barbershopId: req.barbershop!.id },
    include: { barbershop: true, service: true },
  })
  if (!appointment) {
    res.status(404).json({ message: 'Agendamento não encontrado' })
    return
  }

  const ownsAppointment = appointment.userId === user.id
  const membership = user.role === 'CUSTOMER' ? null : await prisma.membership.findUnique({
    where: { barbershopId_userId: { barbershopId: barbershop.id, userId: user.id } },
  })
  const canManageAppointment = Boolean(membership
    && (membership.role !== 'BARBER' || appointment.barberId === user.id))
  if (user.role === 'CUSTOMER'
    ? (!ownsAppointment || ('status' in input && input.status !== 'CANCELLED'))
    : !canManageAppointment) {
    res.status(403).json({ message: 'Ação não permitida' })
    return
  }
  if ('scheduledAt' in input) {
    if (barbershop.subscriptionStatus !== 'ACTIVE') {
      res.status(402).json({ message: 'Agendamentos temporariamente indisponíveis: assinatura da barbearia inativa' })
      return
    }
    const statusError = validateRescheduleStatus(appointment.status)
    if (statusError) {
      res.status(409).json({ message: statusError })
      return
    }

    const now = new Date()
    const [scheduled, holidays, barberAvailability] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          barbershopId: appointment.barbershopId,
          barberId: appointment.barberId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          OR: [
            { paymentStatus: { not: 'PENDING' } },
            { paymentExpiresAt: { gt: now } },
          ],
        },
        include: { service: true },
      }),
      prisma.holiday.findMany({
        where: { barbershopId: barbershop.id },
        select: { date: true, description: true },
      }),
      loadBarberAvailability(barbershop.id, appointment.barberId),
    ])
    const scheduleError = validateAppointmentSchedule({
      scheduledAt: input.scheduledAt,
      duration: appointment.service.duration,
      timezone: barbershop.timezone,
      businessHours: barbershop.businessHours,
      holidays,
      barberSchedule: barberAvailability.schedule,
      absences: barberAvailability.absences,
      scheduled: scheduled.map((item) => ({
        id: item.id,
        scheduledAt: item.scheduledAt,
        duration: item.service.duration,
      })),
      excludeAppointmentId: appointment.id,
      now,
    })
    if (scheduleError) {
      res.status(scheduleError.code === 'conflict' ? 409 : 400).json({ message: scheduleError.message })
      return
    }

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { scheduledAt: input.scheduledAt, customerConfirmedAt: null },
      include: includeRelations,
    })
    await queueStaffNotificationSafely({
      type: 'RESCHEDULE',
      actorId: user.id,
      appointmentId: updated.id,
      barberId: updated.barberId,
      barbershopId: barbershop.id,
      barbershopName: barbershop.name,
      timezone: barbershop.timezone,
      customerName: updated.user.name,
      serviceName: updated.service.name,
      scheduledAt: updated.scheduledAt,
      previousScheduledAt: appointment.scheduledAt,
    })
    res.json(publicAppointment(updated))
    return
  }

  const { status } = input
  if (status === 'CONFIRMED' && !['APPROVED', 'NOT_REQUIRED'].includes(appointment.paymentStatus)) {
    res.status(409).json({ message: 'O pagamento do sinal ainda não foi aprovado' })
    return
  }

  const allowedTransitions = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['DONE', 'CANCELLED', 'NO_SHOW'],
    CANCELLED: [],
    DONE: ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
    NO_SHOW: [],
  } as const
  const allowedStatuses = allowedTransitions[appointment.status as keyof typeof allowedTransitions] as readonly string[] | undefined
  if (!allowedStatuses?.includes(status)) {
    res.status(409).json({ message: 'Este agendamento não permite essa alteração' })
    return
  }
  if (appointment.status === 'DONE' && membership?.role === 'BARBER') {
    res.status(403).json({ message: 'Apenas dono ou administrador podem reverter um atendimento concluído' })
    return
  }

  const cancelledByRole = cancellationRole(user, membership?.role)
  const cancellationReason = 'reason' in input ? input.reason : undefined
  const reasonError = status === 'CANCELLED' ? cancellationReasonError(cancelledByRole, cancellationReason) : null
  if (reasonError) {
    res.status(400).json({ message: reasonError })
    return
  }
  const quote = status === 'CANCELLED' ? cancellationQuote({
    scheduledAt: appointment.scheduledAt,
    cancelledAt: new Date(),
    cancellationWindowHours: barbershop.cancellationWindowHours,
    lateCancellationFeeBps: barbershop.lateCancellationFeeBps,
    paidDepositCents: appointment.paymentStatus === 'APPROVED' ? appointment.paymentAmountCents : 0,
    cancelledByRole,
  }) : null

  if (quote && quote.refundedCents > 0 && appointment.mercadoPagoPaymentId) {
    await mercadoPagoClient().refundPayment(
      appointment.mercadoPagoPaymentId,
      await sellerAccessToken(appointment.barbershop),
      `appointment-${appointment.id}-refund`,
      quote.feeCents > 0 ? quote.refundedCents : undefined,
    )
  }
  const appointmentData = {
    status,
    ...(quote && quote.refundedCents === appointment.paymentAmountCents && appointment.paymentStatus === 'APPROVED'
      ? { paymentStatus: 'REFUNDED' as const }
      : {}),
  }
  const updated = appointment.status === 'DONE' || status === 'DONE' || status === 'CANCELLED'
    ? await prisma.$transaction(async (tx) => {
      if (appointment.status === 'DONE' && status !== 'DONE') {
        await tx.loyaltyStamp.deleteMany({ where: { barbershopId: barbershop.id, appointmentId: appointment.id } })
      }
      if (quote) {
        await tx.appointmentCancellation.create({
          data: {
            appointmentId: appointment.id,
            barbershopId: barbershop.id,
            cancelledById: user.id,
            cancelledByRole,
            reason: cancellationReason?.trim() || null,
            hoursBefore: quote.hoursBefore,
            refundedCents: quote.refundedCents,
            feeCents: quote.feeCents,
          },
        })
      }
      const result = await tx.appointment.update({
        where: { id: appointment.id },
        data: appointmentData,
        include: includeRelations,
      })
      if (appointment.status !== 'DONE' && status === 'DONE') {
        const program = await tx.loyaltyProgram.findUnique({ where: { barbershopId: barbershop.id } })
        if (program?.enabled) {
          await tx.loyaltyStamp.upsert({
            where: { appointmentId: appointment.id },
            update: {},
            create: { barbershopId: barbershop.id, userId: appointment.userId, appointmentId: appointment.id },
          })
        }
      }
      return result
    })
    : await prisma.appointment.update({
      where: { id: appointment.id },
      data: appointmentData,
      include: includeRelations,
    })
  if (status === 'DONE' && appointment.walkInQueueId) {
    const unfinishedItems = await prisma.appointment.count({
      where: { walkInQueueId: appointment.walkInQueueId, status: { not: 'DONE' } },
    })
    if (unfinishedItems === 0) {
      await prisma.walkInQueue.updateMany({
        where: { id: appointment.walkInQueueId, status: 'IN_SERVICE' },
        data: { status: 'DONE', finishedAt: new Date() },
      })
    }
  }
  if (status === 'CANCELLED' || status === 'NO_SHOW') {
    await queueStaffNotificationSafely({
      type: status === 'CANCELLED' ? 'CANCELLATION' : 'NO_SHOW',
      actorId: user.id,
      appointmentId: updated.id,
      barberId: updated.barberId,
      barbershopId: barbershop.id,
      barbershopName: barbershop.name,
      timezone: barbershop.timezone,
      customerName: updated.user.name,
      serviceName: updated.service.name,
      scheduledAt: updated.scheduledAt,
    })
  }
  res.json(publicAppointment(updated))
})

function cancellationRole(user: SessionUser, membershipRole: string | undefined): CancellationRole {
  if (user.role === 'CUSTOMER') return 'CUSTOMER'
  return membershipRole === 'OWNER' || membershipRole === 'ADMIN' ? membershipRole : 'BARBER'
}

async function queueStaffNotificationSafely(event: StaffAppointmentEvent): Promise<void> {
  try {
    await enqueueStaffAppointmentNotification(event)
  } catch (error) {
    console.error('Falha ao enfileirar aviso de agenda', error)
  }
}

function publicAppointment(appointment: {
  id: string
  userId: string
  barberId: string
  serviceId: string
  scheduledAt: Date
  status: string
  paymentStatus: string
  paymentExpiresAt: Date | null
  paymentAmountCents: number
  commissionCents: number
  customerConfirmedAt?: Date | null
  user: { id: string; name: string; email: string | null; phone?: string | null; role: string }
  barber: { id: string; name: string; email: string | null; role: string }
  service: { id: string; name: string; duration: number; priceCents: number }
  reminders?: Array<{
    kind: string
    channel: string
    sentAt: Date
    deliveredOk: boolean
    error: string | null
  }>
  cancellation?: {
    cancelledByRole: string
    reason: string | null
    hoursBefore: number
    refundedCents: number
    feeCents: number
    createdAt: Date
  } | null
}, noShowCount = 0) {
  const mapUser = (value: typeof appointment.user) => ({
    id: value.id, name: value.name, email: value.email, phone: value.phone ?? null, role: value.role,
  })
  return {
    id: appointment.id,
    userId: appointment.userId,
    barberId: appointment.barberId,
    serviceId: appointment.serviceId,
    scheduledAt: appointment.scheduledAt,
    status: appointment.status,
    paymentStatus: appointment.paymentStatus,
    paymentExpiresAt: appointment.paymentExpiresAt,
    paymentAmount: appointment.paymentAmountCents / 100,
    commission: appointment.commissionCents / 100,
    user: { ...mapUser(appointment.user), noShowCount },
    barber: { ...mapUser(appointment.barber), specialty: 'Cortes e barba' },
    service: {
      id: appointment.service.id,
      name: appointment.service.name,
      duration: appointment.service.duration,
      price: appointment.service.priceCents / 100,
    },
    reminders: (appointment.reminders ?? []).map((reminder) => ({
      kind: reminder.kind,
      channel: reminder.channel,
      sentAt: reminder.sentAt,
      deliveredOk: reminder.deliveredOk,
      error: reminder.error,
    })),
    cancellation: appointment.cancellation ?? null,
    clientConfirmed: Boolean(appointment.customerConfirmedAt),
    depositRetained: appointment.status === 'NO_SHOW' && appointment.paymentStatus === 'APPROVED',
  }
}

async function customerNoShowCounts(barbershopId: string, userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map()
  const counts = await prisma.appointment.groupBy({
    by: ['userId'],
    where: { barbershopId, userId: { in: [...new Set(userIds)] }, status: 'NO_SHOW' },
    _count: { _all: true },
  })
  return new Map(counts.map((item) => [item.userId, item._count._all]))
}

async function selectAvailableBarber(
  barbershop: NonNullable<Express.Request['barbershop']>,
  serviceId: string,
  scheduledAt: Date,
): Promise<string | null> {
  const date = dateInTimezone(scheduledAt, barbershop.timezone)
  const dayStart = dateAtLocalTime(date, '00:00', barbershop.timezone)
  const dayEnd = dateAtLocalTime(nextDate(date), '00:00', barbershop.timezone)
  const now = new Date()
  const [service, barbers, appointments, holidays, schedules, absences] = await Promise.all([
    prisma.service.findFirst({ where: { id: serviceId, barbershopId: barbershop.id, active: true } }),
    prisma.user.findMany({
      where: { memberships: { some: { barbershopId: barbershop.id, role: { in: ['OWNER', 'ADMIN', 'BARBER'] } } } },
      select: { id: true },
    }),
    prisma.appointment.findMany({
      where: {
        barbershopId: barbershop.id,
        scheduledAt: { gte: dayStart, lt: dayEnd },
        status: { not: 'CANCELLED' },
      },
      include: { service: true },
    }),
    prisma.holiday.findMany({ where: { barbershopId: barbershop.id }, select: { date: true, description: true } }),
    prisma.barberSchedule.findMany({ where: { barbershopId: barbershop.id } }),
    prisma.barberAbsence.findMany({ where: { barbershopId: barbershop.id, endsAt: { gt: now } } }),
  ])
  if (!service) return null

  return barbers
    .map((barber) => {
      const barberAppointments = appointments.filter((appointment) => appointment.barberId === barber.id)
      const blockingAppointments = barberAppointments.filter((appointment) => (
        ['PENDING', 'CONFIRMED'].includes(appointment.status)
        && (appointment.paymentStatus !== 'PENDING' || Boolean(appointment.paymentExpiresAt && appointment.paymentExpiresAt > now))
      ))
      const error = validateAppointmentSchedule({
        scheduledAt,
        duration: service.duration,
        timezone: barbershop.timezone,
        businessHours: barbershop.businessHours,
        holidays,
        barberSchedule: schedules.filter((item) => item.barberId === barber.id),
        absences: absences.filter((item) => item.barberId === barber.id),
        scheduled: blockingAppointments.map((appointment) => ({
          id: appointment.id,
          scheduledAt: appointment.scheduledAt,
          duration: appointment.service.duration,
        })),
        now,
      })
      return { id: barber.id, available: !error, load: barberAppointments.length }
    })
    .filter((barber) => barber.available)
    .sort((left, right) => left.load - right.load || left.id.localeCompare(right.id))[0]?.id ?? null
}

async function loadBarberAvailability(barbershopId: string, barberId: string) {
  const [schedule, absences] = await Promise.all([
    prisma.barberSchedule.findMany({
      where: { barbershopId, barberId },
      orderBy: { weekday: 'asc' },
    }),
    prisma.barberAbsence.findMany({
      where: { barbershopId, barberId, endsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
    }),
  ])
  return { schedule, absences }
}

const dayMs = 24 * 60 * 60 * 1000

function calendarDates(from: string, to: string): string[] | null {
  const fromTime = Date.parse(`${from}T00:00:00.000Z`)
  const toTime = Date.parse(`${to}T00:00:00.000Z`)
  if (toTime < fromTime) return null
  return Array.from({ length: Math.floor((toTime - fromTime) / dayMs) + 1 }, (_, index) => (
    new Date(fromTime + index * dayMs).toISOString().slice(0, 10)
  ))
}

function nextDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + dayMs).toISOString().slice(0, 10)
}

function dateInTimezone(date: Date, timezone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

function weekdayInTimezone(date: string, timezone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(dateAtLocalTime(date, '12:00', timezone))
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[weekday] ?? -1
}

export { router as appointmentsRoutes }

const membershipVisitDatabase: MembershipVisitDatabase = {
  findSubscription: (barbershopId, userId) => prisma.customerSubscription.findFirst({
    where: { barbershopId, userId }, include: { plan: true }, orderBy: { createdAt: 'desc' },
  }),
  updatePeriod: async (id, period) => { await prisma.customerSubscription.update({ where: { id }, data: period }) },
  incrementVisit: async (id, expectedVisitsUsed) => {
    const updated = await prisma.customerSubscription.updateMany({
      where: { id, status: 'ACTIVE', visitsUsed: expectedVisitsUsed }, data: { visitsUsed: { increment: 1 } },
    })
    return updated.count === 1
  },
}
