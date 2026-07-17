import { Router } from 'express'
import { z } from 'zod'
import { calculateCommissionCents, calculateDepositCents } from '../domain/billing.js'
import { mercadoPagoClient, sellerAccessToken } from '../lib/mercado-pago-config.js'
import { prisma } from '../lib/prisma.js'
import { schedulesOverlap, validateBusinessHours } from '../lib/schedule.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'
import { resolveBarbershop } from '../middleware/barbershop.js'

const router = Router()
const includeRelations = { user: true, barber: true, service: true } as const

router.use(requireUser, resolveBarbershop)

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
  res.json(appointments.map(publicAppointment))
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
    barberId: z.string().uuid(),
    serviceId: z.string().uuid(),
    scheduledAt: z.coerce.date(),
  }).parse(req.body)

  const [service, barber, scheduled] = await Promise.all([
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
          { paymentExpiresAt: { gt: new Date() } },
        ],
      },
      include: { service: true },
    }),
  ])
  if (!service || !barber) {
    res.status(400).json({ message: 'Serviço ou barbeiro inválido' })
    return
  }
  const scheduleError = validateBusinessHours({
    scheduledAt: input.scheduledAt,
    duration: service.duration,
    timezone: barbershop.timezone,
    businessHours: barbershop.businessHours,
  })
  if (scheduleError) {
    res.status(400).json({ message: scheduleError })
    return
  }
  const conflict = scheduled.some((item) => schedulesOverlap(
    { scheduledAt: item.scheduledAt, duration: item.service.duration },
    { scheduledAt: input.scheduledAt, duration: service.duration },
  ))
  if (conflict) {
    res.status(409).json({ message: 'Este horário acabou de ser reservado' })
    return
  }

  const depositPolicy = { type: barbershop.depositType, value: barbershop.depositValue }
  const paymentAmountCents = calculateDepositCents(service.priceCents, depositPolicy)
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
      ...input,
      barbershopId: barbershop.id,
      userId: user.id,
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

  res.status(201).json({ appointment: publicAppointment(appointment), checkoutUrl })
})

router.patch('/:id', async (req, res) => {
  const user = req.user as SessionUser
  const id = z.string().uuid().parse(req.params.id)
  const { status } = z.object({
    status: z.enum(['CONFIRMED', 'CANCELLED', 'DONE']),
  }).parse(req.body)

  const appointment = await prisma.appointment.findFirst({
    where: { id, barbershopId: req.barbershop!.id },
    include: { barbershop: true },
  })
  if (!appointment) {
    res.status(404).json({ message: 'Agendamento não encontrado' })
    return
  }

  const ownsAppointment = user.role === 'CUSTOMER'
    ? appointment.userId === user.id
    : appointment.barberId === user.id
  if (!ownsAppointment || (user.role === 'CUSTOMER' && status !== 'CANCELLED')) {
    res.status(403).json({ message: 'Ação não permitida' })
    return
  }
  if (status === 'CONFIRMED' && !['APPROVED', 'NOT_REQUIRED'].includes(appointment.paymentStatus)) {
    res.status(409).json({ message: 'O pagamento do sinal ainda não foi aprovado' })
    return
  }

  const allowedTransitions = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['DONE', 'CANCELLED'],
    CANCELLED: [],
    DONE: [],
  } as const
  const allowedStatuses = allowedTransitions[appointment.status as keyof typeof allowedTransitions] as readonly string[] | undefined
  if (!allowedStatuses?.includes(status)) {
    res.status(409).json({ message: 'Este agendamento não permite essa alteração' })
    return
  }

  if (status === 'CANCELLED' && appointment.paymentStatus === 'APPROVED' && appointment.mercadoPagoPaymentId) {
    await mercadoPagoClient().refundPayment(
      appointment.mercadoPagoPaymentId,
      await sellerAccessToken(appointment.barbershop),
      `appointment-${appointment.id}-refund`,
    )
  }
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      status,
      ...(status === 'CANCELLED' && appointment.paymentStatus === 'APPROVED' ? { paymentStatus: 'REFUNDED' } : {}),
    },
    include: includeRelations,
  })
  res.json(publicAppointment(updated))
})

function publicAppointment(appointment: {
  id: string
  userId: string
  barberId: string
  serviceId: string
  scheduledAt: Date
  status: string
  paymentStatus: string
  paymentAmountCents: number
  commissionCents: number
  user: { id: string; name: string; email: string | null; role: string }
  barber: { id: string; name: string; email: string | null; role: string }
  service: { id: string; name: string; duration: number; priceCents: number }
}) {
  const mapUser = (value: typeof appointment.user) => ({
    id: value.id, name: value.name, email: value.email, role: value.role,
  })
  return {
    id: appointment.id,
    userId: appointment.userId,
    barberId: appointment.barberId,
    serviceId: appointment.serviceId,
    scheduledAt: appointment.scheduledAt,
    status: appointment.status,
    paymentStatus: appointment.paymentStatus,
    paymentAmount: appointment.paymentAmountCents / 100,
    commission: appointment.commissionCents / 100,
    user: mapUser(appointment.user),
    barber: { ...mapUser(appointment.barber), specialty: 'Cortes e barba' },
    service: {
      id: appointment.service.id,
      name: appointment.service.name,
      duration: appointment.service.duration,
      price: appointment.service.priceCents / 100,
    },
  }
}

export { router as appointmentsRoutes }
