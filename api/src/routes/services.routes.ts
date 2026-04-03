import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { z } from 'zod'

const router = Router()

router.get('/', async (req, res) => {
  const services = await prisma.service.findMany()
  res.json(services)
})

router.post('/', async (req, res) => {
  const schema = z.object({
    name: z.string(),
    duration: z.number(),
    price: z.number(),
  })

  const { name, duration, price } = schema.parse(req.body)

  const service = await prisma.service.create({
    data: { name, duration, price },
  })

  res.status(201).json(service)
})

export { router as servicesRoutes }
