import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireUser } from '../middleware/auth.js'
import { requireBarbershopRole, resolveBarbershop } from '../middleware/barbershop.js'

const router = Router()
const planInput = z.object({
  name: z.string().trim().min(3).max(80),
  priceCents: z.number().int().positive(),
  intervalDays: z.number().int().min(1).max(365),
  includedVisits: z.number().int().min(1).max(100),
  serviceIds: z.array(z.string().uuid()).min(1),
  active: z.boolean().optional(),
})

router.use(requireUser, resolveBarbershop)

router.get('/', async (req, res) => {
  const plans = await prisma.membershipPlan.findMany({
    where: { barbershopId: req.barbershop!.id }, orderBy: { createdAt: 'desc' },
  })
  res.json(plans)
})

router.post('/', requireBarbershopRole('OWNER', 'ADMIN'), async (req, res) => {
  const input = planInput.parse(req.body)
  if (!await validServices(req.barbershop!.id, input.serviceIds)) { res.status(400).json({ message: 'Serviço inválido no plano' }); return }
  const plan = await prisma.membershipPlan.create({ data: {
    name: input.name, priceCents: input.priceCents, intervalDays: input.intervalDays,
    includedVisits: input.includedVisits, serviceIds: input.serviceIds, barbershopId: req.barbershop!.id,
    ...(input.active !== undefined ? { active: input.active } : {}),
  } })
  res.status(201).json(plan)
})

router.patch('/:id', requireBarbershopRole('OWNER', 'ADMIN'), async (req, res) => {
  const id = z.string().uuid().parse(req.params.id)
  const input = planInput.partial().refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo').parse(req.body)
  if (input.serviceIds && !await validServices(req.barbershop!.id, input.serviceIds)) { res.status(400).json({ message: 'Serviço inválido no plano' }); return }
  const updated = await prisma.membershipPlan.updateMany({
    where: { id, barbershopId: req.barbershop!.id }, data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
      ...(input.intervalDays !== undefined ? { intervalDays: input.intervalDays } : {}),
      ...(input.includedVisits !== undefined ? { includedVisits: input.includedVisits } : {}),
      ...(input.serviceIds !== undefined ? { serviceIds: input.serviceIds } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  })
  if (!updated.count) { res.status(404).json({ message: 'Plano não encontrado' }); return }
  res.json(await prisma.membershipPlan.findUniqueOrThrow({ where: { id } }))
})

async function validServices(barbershopId: string, serviceIds: string[]): Promise<boolean> {
  const count = await prisma.service.count({ where: { barbershopId, id: { in: serviceIds }, active: true } })
  return count === new Set(serviceIds).size
}

export { router as plansRoutes }
