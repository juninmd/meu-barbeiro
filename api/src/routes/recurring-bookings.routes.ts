import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'
import { resolveBarbershop } from '../middleware/barbershop.js'

const router = Router()
const inputSchema = z.object({
  subscriptionId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  barberId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1),
  weekday: z.number().int().min(0).max(6),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
})

router.use(requireUser, resolveBarbershop)

router.get('/', async (req, res) => {
  const user = req.user as SessionUser
  const membership = await prisma.membership.findUnique({
    where: { barbershopId_userId: { barbershopId: req.barbershop!.id, userId: user.id } },
  })
  const canManage = Boolean(membership && ['OWNER', 'ADMIN'].includes(membership.role))
  const bookings = await prisma.recurringBooking.findMany({
    where: { barbershopId: req.barbershop!.id, ...(canManage ? {} : { userId: user.id }) },
    include: {
      subscription: { include: { plan: true } },
      user: { select: { id: true, name: true } }, barber: { select: { id: true, name: true } },
      occurrences: { where: { status: 'PENDING' }, orderBy: { scheduledAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(bookings)
})

router.post('/', async (req, res) => {
  const input = inputSchema.parse(req.body)
  const actor = req.user as SessionUser
  const membership = await prisma.membership.findUnique({
    where: { barbershopId_userId: { barbershopId: req.barbershop!.id, userId: actor.id } },
  })
  const canManage = Boolean(membership && ['OWNER', 'ADMIN'].includes(membership.role))
  const userId = canManage && input.userId ? input.userId : actor.id
  if (!canManage && input.userId && input.userId !== actor.id) { res.status(403).json({ message: 'Acesso negado para este cliente' }); return }
  const subscription = await prisma.customerSubscription.findFirst({
    where: { id: input.subscriptionId, barbershopId: req.barbershop!.id, userId, status: 'ACTIVE' }, include: { plan: true },
  })
  if (!subscription) { res.status(400).json({ message: 'Assinatura ativa não encontrada' }); return }
  if (input.serviceIds.some((id) => !subscription.plan.serviceIds.includes(id))) {
    res.status(400).json({ message: 'O horário fixo contém serviço fora do plano' }); return
  }
  const [serviceCount, barber] = await Promise.all([
    prisma.service.count({ where: { barbershopId: req.barbershop!.id, id: { in: input.serviceIds }, active: true } }),
    prisma.membership.findFirst({ where: { barbershopId: req.barbershop!.id, userId: input.barberId, role: { in: ['OWNER', 'ADMIN', 'BARBER'] } } }),
  ])
  if (serviceCount !== new Set(input.serviceIds).size || !barber) { res.status(400).json({ message: 'Serviço ou barbeiro inválido' }); return }
  const booking = await prisma.recurringBooking.create({
    data: { ...input, userId, barbershopId: req.barbershop!.id },
  })
  res.status(201).json(booking)
})

router.delete('/:id', async (req, res) => {
  const id = z.string().uuid().parse(req.params.id)
  const actor = req.user as SessionUser
  const membership = await prisma.membership.findUnique({
    where: { barbershopId_userId: { barbershopId: req.barbershop!.id, userId: actor.id } },
  })
  const canManage = Boolean(membership && ['OWNER', 'ADMIN'].includes(membership.role))
  const updated = await prisma.recurringBooking.updateMany({
    where: { id, barbershopId: req.barbershop!.id, ...(canManage ? {} : { userId: actor.id }) }, data: { active: false },
  })
  if (!updated.count) { res.status(404).json({ message: 'Horário fixo não encontrado' }); return }
  res.status(204).end()
})

export { router as recurringBookingsRoutes }
