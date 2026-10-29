import { Router } from 'express'
import { z } from 'zod'
import { loadPublicUser } from '../lib/public-user.js'
import { prisma } from '../lib/prisma.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'

const router = Router()

router.use(requireUser)

router.patch('/profile', async (req, res, next) => {
  try {
    const user = req.user as SessionUser
    const input = z.object({
      name: z.string().trim().min(2).max(80),
      phone: z.union([z.string().trim().regex(/^\+?\d{10,15}$/, 'Telefone inválido'), z.literal('').transform(() => null), z.null()]).optional(),
    }).strict().parse(req.body)
    await prisma.user.update({ where: { id: user.id }, data: { name: input.name, ...(input.phone !== undefined ? { phone: input.phone } : {}) } })
    res.json(await loadPublicUser(user.id))
  } catch (error) {
    next(error)
  }
})

// O usuário pede permissão para cadastrar o estabelecimento onde atua como barbeiro.
router.post('/establishment-request', async (req, res, next) => {
  try {
    const user = req.user as SessionUser
    const input = z.object({ note: z.string().trim().min(3, 'Conte qual é o seu estabelecimento').max(300) }).strict().parse(req.body)
    if (user.establishmentRequest === 'PENDING') {
      res.status(409).json({ message: 'Você já tem uma solicitação em análise' })
      return
    }
    if (user.establishmentRequest === 'APPROVED') {
      res.status(409).json({ message: 'Sua solicitação já foi aprovada. Cadastre o estabelecimento.' })
      return
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { establishmentRequest: 'PENDING', establishmentRequestNote: input.note, establishmentRequestedAt: new Date(), establishmentDecidedAt: null },
    })
    res.status(201).json(await loadPublicUser(user.id))
  } catch (error) {
    next(error)
  }
})

export { router as accountRoutes }
