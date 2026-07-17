import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireUser } from '../middleware/auth.js'
import { resolveBarbershop } from '../middleware/barbershop.js'

const router = Router()

router.get('/', requireUser, resolveBarbershop, async (req, res) => {
  const users = await prisma.user.findMany({
    where: {
      memberships: {
        some: { barbershopId: req.barbershop!.id, role: { in: ['OWNER', 'ADMIN', 'BARBER'] } },
      },
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  })
  res.json(users.map((user) => ({ ...user, specialty: 'Cortes e barba' })))
})

export { router as barbersRoutes }
