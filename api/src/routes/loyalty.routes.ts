import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'
import { requireBarbershopRole, resolveBarbershop } from '../middleware/barbershop.js'

const router = Router()
const memberRoles = requireBarbershopRole('OWNER', 'ADMIN', 'BARBER')

router.use(requireUser, resolveBarbershop)

router.get('/me', async (req, res) => {
  const user = req.user as SessionUser
  if (user.role !== 'CUSTOMER') {
    res.status(403).json({ message: 'Apenas clientes podem consultar o próprio cartão' })
    return
  }
  res.json(await loyaltyCard(req.barbershop!.id, user.id))
})

router.get('/program', requireBarbershopRole('OWNER', 'ADMIN'), async (req, res) => {
  const program = await prisma.loyaltyProgram.findUnique({ where: { barbershopId: req.barbershop!.id } })
  res.json(program ? publicProgram(program) : null)
})

router.get('/:userId', memberRoles, async (req, res) => {
  const userId = z.string().uuid().parse(req.params.userId)
  const exists = await prisma.appointment.findFirst({
    where: { barbershopId: req.barbershop!.id, userId },
    select: { id: true },
  })
  if (!exists) {
    res.status(404).json({ message: 'Cliente não encontrado nesta barbearia' })
    return
  }
  res.json(await loyaltyCard(req.barbershop!.id, userId))
})

router.put('/program', requireBarbershopRole('OWNER', 'ADMIN'), async (req, res) => {
  const input = z.object({
    enabled: z.boolean(),
    requiredVisits: z.number().int().min(1).max(100),
    rewardDescription: z.string().trim().min(3).max(160),
  }).strict().parse(req.body)
  const program = await prisma.loyaltyProgram.upsert({
    where: { barbershopId: req.barbershop!.id },
    update: input,
    create: { ...input, barbershopId: req.barbershop!.id },
  })
  res.json(publicProgram(program))
})

router.post('/redeem', memberRoles, async (req, res) => {
  const { userId } = z.object({ userId: z.string().uuid() }).strict().parse(req.body)
  const barbershopId = req.barbershop!.id
  const redeemedAt = new Date()
  try {
    await prisma.$transaction(async (tx) => {
      const program = await tx.loyaltyProgram.findUnique({ where: { barbershopId } })
      if (!program?.enabled) throw new LoyaltyConflict('O programa de fidelidade não está ativo')
      const stamps = await tx.loyaltyStamp.findMany({
        where: { barbershopId, userId, redeemedAt: null },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: program.requiredVisits,
      })
      if (stamps.length < program.requiredVisits) throw new LoyaltyConflict('O cliente ainda não possui selos suficientes')
      const consumed = await tx.loyaltyStamp.updateMany({
        where: { id: { in: stamps.map((stamp) => stamp.id) }, redeemedAt: null },
        data: { redeemedAt },
      })
      if (consumed.count !== program.requiredVisits) throw new LoyaltyConflict('O cartão mudou durante o resgate; tente novamente')
    })
  } catch (error) {
    if (error instanceof LoyaltyConflict) {
      res.status(409).json({ message: error.message })
      return
    }
    throw error
  }
  res.json(await loyaltyCard(barbershopId, userId))
})

async function loyaltyCard(barbershopId: string, userId: string) {
  const [program, stamps] = await Promise.all([
    prisma.loyaltyProgram.findUnique({ where: { barbershopId } }),
    prisma.loyaltyStamp.findMany({
      where: { barbershopId, userId },
      select: { id: true, appointmentId: true, createdAt: true, redeemedAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  const requiredVisits = program?.requiredVisits ?? 10
  const availableStamps = stamps.filter((stamp) => stamp.redeemedAt === null).length
  const availableRewards = program?.enabled ? Math.floor(availableStamps / requiredVisits) : 0
  return {
    program: program ? publicProgram(program) : null,
    availableStamps,
    availableRewards,
    remainingToReward: program?.enabled ? (availableRewards > 0 ? 0 : requiredVisits - availableStamps) : requiredVisits,
    stamps,
  }
}

function publicProgram(program: { id: string; enabled: boolean; requiredVisits: number; rewardDescription: string }) {
  return { id: program.id, enabled: program.enabled, requiredVisits: program.requiredVisits, rewardDescription: program.rewardDescription }
}

class LoyaltyConflict extends Error {}

export { router as loyaltyRoutes }
