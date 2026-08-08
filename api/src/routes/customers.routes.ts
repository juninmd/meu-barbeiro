import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'
import { requireBarbershopRole, resolveBarbershop } from '../middleware/barbershop.js'

const router = Router()
const memberOnly = requireBarbershopRole('OWNER', 'ADMIN', 'BARBER')

router.use(requireUser, resolveBarbershop)
router.use((req, res, next) => {
  if ((req.user as SessionUser).role === 'CUSTOMER') {
    res.status(403).json({ message: 'Clientes não podem acessar fichas internas' })
    return
  }
  next()
})

router.get('/', memberOnly, async (req, res) => {
  const { search } = z.object({ search: z.string().trim().max(80).optional() }).parse(req.query)
  const phone = search?.replace(/\D/g, '')
  const barbershopId = req.barbershop!.id
  const customers = await prisma.user.findMany({
    where: {
      role: 'CUSTOMER',
      OR: [
        { appointments: { some: { barbershopId } } },
        { customerProfiles: { some: { barbershopId } } },
      ],
      ...(search ? {
        AND: [{
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            ...(phone ? [{ phone: { contains: phone } }] : []),
          ],
        }],
      } : {}),
    },
    select: { id: true, name: true, phone: true },
    orderBy: { name: 'asc' },
    take: 20,
  })
  const noShows = await prisma.appointment.groupBy({
    by: ['userId'],
    where: { barbershopId, userId: { in: customers.map((customer) => customer.id) }, status: 'NO_SHOW' },
    _count: { _all: true },
  })
  const noShowCounts = new Map(noShows.map((item) => [item.userId, item._count._all]))
  res.json(customers.map((customer) => ({ ...customer, noShowCount: noShowCounts.get(customer.id) ?? 0 })))
})

router.get('/:userId/profile', memberOnly, async (req, res) => {
  const userId = z.string().uuid().parse(req.params.userId)
  const result = await loadCustomerProfile(req.barbershop!.id, userId)
  if (!result) {
    res.status(404).json({ message: 'Cliente não encontrado nesta barbearia' })
    return
  }
  res.json(result)
})

router.put('/:userId/profile', memberOnly, async (req, res) => {
  const userId = z.string().uuid().parse(req.params.userId)
  const input = z.object({
    preferences: z.string().trim().max(2_000).nullable().optional(),
    notes: z.string().trim().max(2_000).nullable().optional(),
    allergies: z.string().trim().max(2_000).nullable().optional(),
  }).strict().parse(req.body)
  const barbershopId = req.barbershop!.id
  if (!await customerBelongsToBarbershop(barbershopId, userId)) {
    res.status(404).json({ message: 'Cliente não encontrado nesta barbearia' })
    return
  }
  const user = req.user as SessionUser
  const profileData = {
    ...(input.preferences !== undefined ? { preferences: input.preferences } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.allergies !== undefined ? { allergies: input.allergies } : {}),
  }
  await prisma.customerProfile.upsert({
    where: { barbershopId_userId: { barbershopId, userId } },
    update: { ...profileData, updatedById: user.id },
    create: { ...profileData, barbershopId, userId, updatedById: user.id },
  })
  res.json(await loadCustomerProfile(barbershopId, userId))
})

async function customerBelongsToBarbershop(barbershopId: string, userId: string): Promise<boolean> {
  return Boolean(await prisma.user.findFirst({
    where: {
      id: userId,
      role: 'CUSTOMER',
      OR: [
        { appointments: { some: { barbershopId } } },
        { customerProfiles: { some: { barbershopId } } },
      ],
    },
    select: { id: true },
  }))
}

async function loadCustomerProfile(barbershopId: string, userId: string) {
  if (!await customerBelongsToBarbershop(barbershopId, userId)) return null
  const [profile, history] = await Promise.all([
    prisma.customerProfile.findUnique({
      where: { barbershopId_userId: { barbershopId, userId } },
      include: { updatedBy: { select: { id: true, name: true } } },
    }),
    prisma.appointment.findMany({
      where: { barbershopId, userId, status: { in: ['DONE', 'NO_SHOW'] } },
      include: { service: true, barber: true },
      orderBy: { scheduledAt: 'desc' },
    }),
  ])
  const completed = history.filter((appointment) => appointment.status === 'DONE')
  const last = completed[0]
  return {
    profile: profile ? {
      id: profile.id,
      preferences: profile.preferences,
      notes: profile.notes,
      allergies: profile.allergies,
      updatedAt: profile.updatedAt,
      updatedBy: profile.updatedBy,
    } : null,
    history: {
      completedAppointments: completed.length,
      noShows: history.filter((appointment) => appointment.status === 'NO_SHOW').length,
      lastService: last ? { id: last.service.id, name: last.service.name } : null,
      lastBarber: last ? { id: last.barber.id, name: last.barber.name } : null,
      averageTicket: completed.length
        ? completed.reduce((total, appointment) => total + appointment.service.priceCents, 0) / completed.length / 100
        : 0,
    },
  }
}

export { router as customersRoutes }
