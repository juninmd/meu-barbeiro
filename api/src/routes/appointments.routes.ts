import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'
import { schedulesOverlap, validateBusinessHours } from '../lib/schedule.js'

const router = Router()
const includeRelations = { user: true, barber: true, service: true } as const

router.use(requireUser)

router.get('/', async (req, res) => {
  const user = req.user as SessionUser
  const where = user.role === 'CUSTOMER' ? { userId: user.id } : { barberId: user.id }
  const appointments = await prisma.appointment.findMany({
    where,
    include: includeRelations,
    orderBy: { scheduledAt: 'asc' },
  })
  res.json(appointments)
})

router.post('/', async (req, res) => {
  const user = req.user as SessionUser
  if (user.role !== 'CUSTOMER') {
    res.status(403).json({ message: 'Apenas clientes podem solicitar horários' })
    return
  }

  const input = z.object({
    barberId: z.string().uuid(),
    serviceId: z.string().uuid(),
    scheduledAt: z.coerce.date(),
  }).parse(req.body)

  const [service, barber, scheduled] = await Promise.all([
    prisma.service.findUnique({ where: { id: input.serviceId } }),
    prisma.user.findFirst({ where: { id: input.barberId, role: 'BARBER' } }),
    prisma.appointment.findMany({
      where: { barberId: input.barberId, status: { in: ['PENDING', 'CONFIRMED'] } },
      include: { service: true },
    }),
  ])
  if (!service || !barber) {
    res.status(400).json({ message: 'Serviço ou barbeiro inválido' })
    return
  }
  const scheduleError = validateBusinessHours({ scheduledAt: input.scheduledAt, duration: service.duration })
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

  const appointment = await prisma.appointment.create({
    data: { ...input, userId: user.id },
    include: includeRelations,
  })
  res.status(201).json(appointment)
})

router.patch('/:id', async (req, res) => {
  const user = req.user as SessionUser
  const id = z.string().uuid().parse(req.params.id)
  const { status } = z.object({
    status: z.enum(['CONFIRMED', 'CANCELLED', 'DONE']),
  }).parse(req.body)

  const appointment = await prisma.appointment.findUnique({ where: { id } })
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

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status },
    include: includeRelations,
  })
  res.json(updated)
})

export { router as appointmentsRoutes }
