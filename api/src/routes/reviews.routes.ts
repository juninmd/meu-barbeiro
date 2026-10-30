import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { summarizeReviews } from '../lib/review-summary.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'
import { requireBarbershopRole, resolveBarbershop } from '../middleware/barbershop.js'

const router = Router()

router.use(requireUser, resolveBarbershop)

const inputSchema = z.object({
  appointmentId: z.string().uuid(),
  rating: z.number().int().min(1, 'Escolha de 1 a 5 estrelas').max(5, 'Escolha de 1 a 5 estrelas'),
  comment: z.string().trim().max(500).optional(),
}).strict()

// O cliente avalia um atendimento concluído seu, uma única vez.
router.post('/', async (req, res, next) => {
  try {
    const user = req.user as SessionUser
    const input = inputSchema.parse(req.body)
    const appointment = await prisma.appointment.findFirst({
      where: { id: input.appointmentId, barbershopId: req.barbershop!.id, userId: user.id },
      select: { id: true, status: true, barberId: true, review: { select: { id: true } } },
    })
    if (!appointment) {
      res.status(404).json({ message: 'Atendimento não encontrado' })
      return
    }
    if (appointment.status !== 'DONE') {
      res.status(409).json({ message: 'Só é possível avaliar atendimentos concluídos' })
      return
    }
    if (appointment.review) {
      res.status(409).json({ message: 'Este atendimento já foi avaliado' })
      return
    }
    const review = await prisma.review.create({
      data: {
        barbershopId: req.barbershop!.id,
        appointmentId: appointment.id,
        userId: user.id,
        barberId: appointment.barberId,
        rating: input.rating,
        comment: input.comment || null,
      },
    })
    res.status(201).json({ appointmentId: review.appointmentId, rating: review.rating, comment: review.comment })
  } catch (error) {
    next(error)
  }
})

// Avaliações que o próprio cliente já enviou (para esconder o botão "Avaliar").
router.get('/mine', async (req, res, next) => {
  try {
    const user = req.user as SessionUser
    const reviews = await prisma.review.findMany({
      where: { barbershopId: req.barbershop!.id, userId: user.id },
      select: { appointmentId: true, rating: true, comment: true },
    })
    res.json(reviews)
  } catch (error) {
    next(error)
  }
})

// Painel da equipe: resumo + últimas avaliações com autor e barbeiro.
router.get('/', requireBarbershopRole('OWNER', 'ADMIN', 'BARBER'), async (req, res, next) => {
  try {
    const user = req.user as SessionUser
    const onlyMine = req.membership!.role === 'BARBER'
    const where = { barbershopId: req.barbershop!.id, ...(onlyMine ? { barberId: user.id } : {}) }
    const [all, latest] = await Promise.all([
      prisma.review.findMany({ where, select: { rating: true } }),
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true, rating: true, comment: true, createdAt: true,
          user: { select: { name: true } },
          barber: { select: { name: true } },
          appointment: { select: { service: { select: { name: true } } } },
        },
      }),
    ])
    res.json({
      summary: summarizeReviews(all.map((item) => item.rating)),
      reviews: latest.map((item) => ({
        id: item.id,
        rating: item.rating,
        comment: item.comment,
        createdAt: item.createdAt.toISOString(),
        customerName: item.user.name,
        barberName: item.barber.name,
        serviceName: item.appointment.service.name,
      })),
    })
  } catch (error) {
    next(error)
  }
})

export { router as reviewsRoutes }
