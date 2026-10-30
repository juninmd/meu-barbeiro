import { Router } from 'express'
import { z } from 'zod'
import { expiryFrom, packageStatus, remainingSessions } from '../lib/package-balance.js'
import { prisma } from '../lib/prisma.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'
import { requireBarbershopRole, resolveBarbershop } from '../middleware/barbershop.js'

const router = Router()
const idSchema = z.string().uuid()

router.use(requireUser, resolveBarbershop)

const packageInput = z.object({
  name: z.string().trim().min(3).max(80),
  serviceId: z.string().uuid().nullable().optional(),
  sessions: z.number().int().min(2).max(50),
  price: z.number().positive().max(100_000),
  validityDays: z.number().int().min(7).max(730),
}).strict()

const publicPackage = (item: { id: string; name: string; serviceId: string | null; sessions: number; priceCents: number; validityDays: number; active: boolean }, serviceNames: Map<string, string>) => ({
  id: item.id,
  name: item.name,
  serviceId: item.serviceId,
  serviceName: item.serviceId ? serviceNames.get(item.serviceId) ?? null : null,
  sessions: item.sessions,
  price: item.priceCents / 100,
  validityDays: item.validityDays,
  active: item.active,
})

const customerPackageView = (item: {
  id: string; name: string; serviceId: string | null; sessionsTotal: number; sessionsUsed: number; priceCents: number; purchasedAt: Date; expiresAt: Date
}, serviceNames: Map<string, string>) => ({
  id: item.id,
  name: item.name,
  serviceId: item.serviceId,
  serviceName: item.serviceId ? serviceNames.get(item.serviceId) ?? null : null,
  sessionsTotal: item.sessionsTotal,
  sessionsUsed: item.sessionsUsed,
  remaining: remainingSessions(item),
  price: item.priceCents / 100,
  purchasedAt: item.purchasedAt.toISOString(),
  expiresAt: item.expiresAt.toISOString(),
  status: packageStatus(item),
})

const serviceNameMap = async (barbershopId: string) => {
  const services = await prisma.service.findMany({ where: { barbershopId }, select: { id: true, name: true } })
  return new Map(services.map((service) => [service.id, service.name]))
}

// Catálogo ativo (qualquer pessoa autenticada); a equipe de gestão também vê os desativados.
router.get('/', async (req, res, next) => {
  try {
    const user = req.user as SessionUser
    const membership = await prisma.membership.findUnique({ where: { barbershopId_userId: { barbershopId: req.barbershop!.id, userId: user.id } } })
    const manager = membership?.role === 'OWNER' || membership?.role === 'ADMIN'
    const [packages, names] = await Promise.all([
      prisma.servicePackage.findMany({ where: { barbershopId: req.barbershop!.id, ...(manager ? {} : { active: true }) }, orderBy: [{ active: 'desc' }, { createdAt: 'desc' }] }),
      serviceNameMap(req.barbershop!.id),
    ])
    res.json(packages.map((item) => publicPackage(item, names)))
  } catch (error) {
    next(error)
  }
})

router.post('/', requireBarbershopRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const input = packageInput.parse(req.body)
    if (input.serviceId) {
      const service = await prisma.service.findFirst({ where: { id: input.serviceId, barbershopId: req.barbershop!.id }, select: { id: true } })
      if (!service) {
        res.status(400).json({ message: 'Serviço não pertence a esta barbearia' })
        return
      }
    }
    const created = await prisma.servicePackage.create({
      data: {
        barbershopId: req.barbershop!.id, name: input.name, serviceId: input.serviceId ?? null,
        sessions: input.sessions, priceCents: Math.round(input.price * 100), validityDays: input.validityDays,
      },
    })
    res.status(201).json(publicPackage(created, await serviceNameMap(req.barbershop!.id)))
  } catch (error) {
    next(error)
  }
})

// Desativar não apaga: pacotes já vendidos continuam valendo.
router.delete('/:id', requireBarbershopRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id)
    const result = await prisma.servicePackage.updateMany({ where: { id, barbershopId: req.barbershop!.id }, data: { active: false } })
    if (result.count === 0) {
      res.status(404).json({ message: 'Pacote não encontrado' })
      return
    }
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

router.post('/:id/sell', requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'), async (req, res, next) => {
  try {
    const seller = req.user as SessionUser
    const id = idSchema.parse(req.params.id)
    const { userId } = z.object({ userId: z.string().uuid() }).strict().parse(req.body)
    const [item, customer] = await Promise.all([
      prisma.servicePackage.findFirst({ where: { id, barbershopId: req.barbershop!.id, active: true } }),
      prisma.user.findFirst({ where: { id: userId, role: 'CUSTOMER' }, select: { id: true } }),
    ])
    if (!item) {
      res.status(404).json({ message: 'Pacote não encontrado ou desativado' })
      return
    }
    if (!customer) {
      res.status(404).json({ message: 'Cliente não encontrado' })
      return
    }
    const now = new Date()
    const created = await prisma.customerPackage.create({
      data: {
        barbershopId: req.barbershop!.id, packageId: item.id, userId: customer.id, soldById: seller.id,
        name: item.name, serviceId: item.serviceId, sessionsTotal: item.sessions, priceCents: item.priceCents,
        purchasedAt: now, expiresAt: expiryFrom(now, item.validityDays),
      },
    })
    res.status(201).json(customerPackageView(created, await serviceNameMap(req.barbershop!.id)))
  } catch (error) {
    next(error)
  }
})

router.get('/mine', async (req, res, next) => {
  try {
    const user = req.user as SessionUser
    const [items, names] = await Promise.all([
      prisma.customerPackage.findMany({ where: { barbershopId: req.barbershop!.id, userId: user.id }, orderBy: { purchasedAt: 'desc' } }),
      serviceNameMap(req.barbershop!.id),
    ])
    res.json(items.map((item) => customerPackageView(item, names)))
  } catch (error) {
    next(error)
  }
})

router.get('/customer/:userId', requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'), async (req, res, next) => {
  try {
    const userId = idSchema.parse(req.params.userId)
    const [items, names] = await Promise.all([
      prisma.customerPackage.findMany({ where: { barbershopId: req.barbershop!.id, userId }, orderBy: { purchasedAt: 'desc' } }),
      serviceNameMap(req.barbershop!.id),
    ])
    res.json(items.map((item) => customerPackageView(item, names)))
  } catch (error) {
    next(error)
  }
})

// Baixa de uma sessão. O UPDATE condicional impede estourar o saldo mesmo com dois cliques simultâneos.
router.post('/customer-packages/:id/redeem', requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'), async (req, res, next) => {
  try {
    const staff = req.user as SessionUser
    const id = idSchema.parse(req.params.id)
    const { note } = z.object({ note: z.string().trim().max(200).optional() }).strict().parse(req.body ?? {})
    const current = await prisma.customerPackage.findFirst({ where: { id, barbershopId: req.barbershop!.id } })
    if (!current) {
      res.status(404).json({ message: 'Pacote do cliente não encontrado' })
      return
    }
    const status = packageStatus(current)
    if (status !== 'ACTIVE') {
      res.status(409).json({ message: status === 'EXHAUSTED' ? 'Este pacote não tem mais sessões' : 'Este pacote expirou' })
      return
    }
    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.customerPackage.updateMany({ where: { id, sessionsUsed: { lt: current.sessionsTotal } }, data: { sessionsUsed: { increment: 1 } } })
      if (claimed.count === 0) return null
      await tx.packageRedemption.create({ data: { customerPackageId: id, redeemedById: staff.id, note: note || null } })
      return tx.customerPackage.findUniqueOrThrow({ where: { id } })
    })
    if (!updated) {
      res.status(409).json({ message: 'Este pacote não tem mais sessões' })
      return
    }
    res.json(customerPackageView(updated, await serviceNameMap(req.barbershop!.id)))
  } catch (error) {
    next(error)
  }
})

export { router as packagesRoutes }
