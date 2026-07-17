import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireUser } from '../middleware/auth.js'

const router = Router()

router.get('/', requireUser, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { role: 'BARBER' },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  })
  res.json(users.map((user) => ({ ...user, specialty: 'Cortes e barba' })))
})

export { router as barbersRoutes }
