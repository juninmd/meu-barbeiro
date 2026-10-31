import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'

const router = Router()

const requirePlatformAdmin = (req: Parameters<typeof requireUser>[0], res: Parameters<typeof requireUser>[1], next: Parameters<typeof requireUser>[2]) => {
  if (!(req.user as SessionUser | undefined)?.platformAdmin) {
    res.status(403).json({ message: 'Acesso restrito ao administrador da plataforma' })
    return
  }
  next()
}

router.use(requireUser, requirePlatformAdmin)

const userSummary = {
  id: true, name: true, email: true, username: true, phone: true, role: true, platformAdmin: true,
  establishmentRequest: true, establishmentRequestNote: true, establishmentRequestedAt: true, establishmentDecidedAt: true,
  createdAt: true,
  memberships: { select: { role: true, barbershop: { select: { slug: true, name: true } } } },
} as const

router.get('/overview', async (_req, res, next) => {
  try {
    const [users, barbershops, pending, active] = await Promise.all([
      prisma.user.count(),
      prisma.barbershop.count(),
      prisma.user.count({ where: { establishmentRequest: 'PENDING' } }),
      prisma.barbershop.count({ where: { subscriptionStatus: 'ACTIVE' } }),
    ])
    res.json({ users, barbershops, pendingRequests: pending, activeSubscriptions: active })
  } catch (error) {
    next(error)
  }
})

router.get('/users', async (req, res, next) => {
  try {
    const { q, status } = z.object({
      q: z.string().trim().max(80).optional(),
      status: z.enum(['NONE', 'PENDING', 'APPROVED', 'REJECTED']).optional(),
    }).parse(req.query)
    const users = await prisma.user.findMany({
      where: {
        ...(status ? { establishmentRequest: status } : {}),
        ...(q ? { OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { username: { contains: q, mode: 'insensitive' } },
        ] } : {}),
      },
      select: userSummary,
      orderBy: [{ establishmentRequestedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 100,
    })
    res.json(users)
  } catch (error) {
    next(error)
  }
})

const decide = async (userId: string, decision: 'APPROVED' | 'REJECTED' | 'NONE') => prisma.user.update({
  where: { id: userId },
  data: { establishmentRequest: decision, establishmentDecidedAt: new Date() },
  select: userSummary,
})

// Aprova, recusa ou revoga a permissão de cadastrar um estabelecimento.
router.post('/users/:id/establishment-decision', async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const { decision } = z.object({ decision: z.enum(['APPROVED', 'REJECTED', 'NONE']) }).strict().parse(req.body)
    res.json(await decide(id, decision))
  } catch (error) {
    next(error)
  }
})

// Autoriza diretamente por e-mail, sem precisar que a pessoa tenha solicitado.
router.post('/authorizations', async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) }).strict().parse(req.body)
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })
    if (!user) {
      res.status(404).json({ message: 'Nenhuma conta com este e-mail. A pessoa precisa criar a conta primeiro.' })
      return
    }
    res.json(await decide(user.id, 'APPROVED'))
  } catch (error) {
    next(error)
  }
})

router.get('/barbershops', async (_req, res, next) => {
  try {
    const shops = await prisma.barbershop.findMany({
      select: {
        id: true, slug: true, name: true, address: true, subscriptionStatus: true, createdAt: true,
        memberships: { where: { role: 'OWNER' }, select: { user: { select: { name: true, email: true } } } },
        _count: { select: { appointments: true, services: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    res.json(shops.map(({ memberships, _count, ...shop }) => ({
      ...shop,
      owner: memberships[0]?.user ?? null,
      appointments: _count.appointments,
      services: _count.services,
    })))
  } catch (error) {
    next(error)
  }
})

export { router as adminRoutes }
