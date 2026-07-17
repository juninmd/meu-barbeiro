import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireRole, requireUser } from '../middleware/auth.js'

const router = Router()

router.get('/', requireUser, async (_req, res) => {
  const services = await prisma.service.findMany({ orderBy: { name: 'asc' } })
  res.json(services)
})

router.post('/', requireRole('BARBER', 'ADMIN'), async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(3).max(80),
    duration: z.number().int().min(10).max(240),
    price: z.number().positive().max(10_000),
  }).parse(req.body)

  const service = await prisma.service.create({ data: input })
  res.status(201).json(service)
})

router.delete('/:id', requireRole('BARBER', 'ADMIN'), async (req, res) => {
  const id = z.string().uuid().parse(req.params.id)
  const activeAppointments = await prisma.appointment.count({
    where: { serviceId: id, status: { in: ['PENDING', 'CONFIRMED'] } },
  })
  if (activeAppointments > 0) {
    res.status(409).json({ message: 'Serviço possui agendamentos ativos' })
    return
  }
  await prisma.service.delete({ where: { id } })
  res.status(204).end()
})

export { router as servicesRoutes }
