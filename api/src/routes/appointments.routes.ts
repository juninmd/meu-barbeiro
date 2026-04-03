import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { z } from 'zod'

const router = Router()

router.get('/', async (req, res) => {
  const appointments = await prisma.appointment.findMany({
    include: {
      user: true,
      barber: true,
      service: true,
    },
  })
  res.json(appointments)
})

router.post('/', async (req, res) => {
  const schema = z.object({
    userId: z.string(),
    barberId: z.string(),
    serviceId: z.string(),
    scheduledAt: z.string().transform((str) => new Date(str)),
  })

  const { userId, barberId, serviceId, scheduledAt } = schema.parse(req.body)

  const appointment = await prisma.appointment.create({
    data: { userId, barberId, serviceId, scheduledAt },
  })

  res.status(201).json(appointment)
})

export { router as appointmentsRoutes }
