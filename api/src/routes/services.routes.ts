import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireUser } from '../middleware/auth.js'
import { resolveBarbershop, requireBarbershopRole } from '../middleware/barbershop.js'
import { calculateCommissionCents } from '../domain/billing.js'

const router = Router()

router.use(requireUser, resolveBarbershop)

router.get('/', async (req, res) => {
  const services = await prisma.service.findMany({
    where: { barbershopId: req.barbershop!.id },
    orderBy: { name: 'asc' },
  })
  res.json(services.map(publicService))
})

router.post('/', requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'), async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(3).max(80),
    duration: z.number().int().min(10).max(240),
    price: z.number().positive().max(10_000),
  }).parse(req.body)

  const priceCents = Math.round(input.price * 100)
  if (
    req.barbershop!.depositType === 'FIXED'
    && req.barbershop!.depositValue < calculateCommissionCents(priceCents)
  ) {
    res.status(400).json({ message: 'Sinal fixo deve cobrir a comissão de 1% do serviço' })
    return
  }

  const service = await prisma.service.create({
    data: {
      barbershopId: req.barbershop!.id,
      name: input.name,
      duration: input.duration,
      priceCents,
    },
  })
  res.status(201).json(publicService(service))
})

router.delete('/:id', requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'), async (req, res) => {
  const id = z.string().uuid().parse(req.params.id)
  const activeAppointments = await prisma.appointment.count({
    where: { barbershopId: req.barbershop!.id, serviceId: id, status: { in: ['PENDING', 'CONFIRMED'] } },
  })
  if (activeAppointments > 0) {
    res.status(409).json({ message: 'Serviço possui agendamentos ativos' })
    return
  }
  await prisma.service.delete({ where: { barbershopId_id: { barbershopId: req.barbershop!.id, id } } })
  res.status(204).end()
})

const publicService = (service: { id: string; name: string; duration: number; priceCents: number }) => ({
  id: service.id,
  name: service.name,
  duration: service.duration,
  price: service.priceCents / 100,
})

export { router as servicesRoutes }
