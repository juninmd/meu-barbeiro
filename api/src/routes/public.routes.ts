import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'

const router = Router()
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(60)

const phoneSchema = z.string().trim().min(8).max(30).transform((value) => value.replace(/\D/g, ''))
  .refine((digits) => digits.length >= 8 && digits.length <= 15, 'Telefone inválido')

/**
 * Sessão de cliente sem senha, pelo link público da barbearia.
 *
 * O telefone é a identidade — o mesmo critério já usado no atendimento de
 * balcão. Quem tem o número consegue ver os próprios horários; por isso a rota
 * tem limite de tentativas e nunca autentica contas da equipe.
 *
 * Próximo passo de segurança: confirmar o telefone por código (WhatsApp/SMS).
 */
router.post('/:slug/session', async (req, res, next) => {
  try {
    const slug = slugSchema.parse(req.params.slug)
    const input = z.object({
      name: z.string().trim().min(2).max(80),
      phone: phoneSchema,
    }).parse(req.body)

    const barbershop = await prisma.barbershop.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, logoUrl: true, primaryColor: true, timezone: true },
    })
    if (!barbershop) {
      res.status(404).json({ message: 'Barbearia não encontrada', code: 'SHOP_NOT_FOUND' })
      return
    }

    const user = await prisma.user.upsert({
      where: { phone: input.phone },
      update: { name: input.name },
      create: { name: input.name, phone: input.phone, role: 'CUSTOMER' },
    })

    if (user.role !== 'CUSTOMER') {
      res.status(409).json({
        message: 'Este telefone pertence a uma conta da equipe. Entre com Google.',
        code: 'STAFF_PHONE',
      })
      return
    }

    req.login(user, (error) => {
      if (error) return next(error)
      logger.info('public.guest-session', { userId: user.id, barbershopId: barbershop.id })
      res.status(201).json({
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
        barbershop,
      })
    })
  } catch (error) {
    next(error)
  }
})

export { router as publicRoutes }
