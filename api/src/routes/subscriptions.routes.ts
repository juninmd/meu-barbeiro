import { Router } from 'express'
import { z } from 'zod'
import { mercadoPagoClient } from '../lib/mercado-pago-config.js'
import { prisma } from '../lib/prisma.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'
import { requireBarbershopRole, resolveBarbershop } from '../middleware/barbershop.js'

const router = Router()
const frontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173'

router.use(requireUser, resolveBarbershop)

router.post('/', async (req, res) => {
  const user = req.user as SessionUser
  if (user.role !== 'CUSTOMER') { res.status(403).json({ message: 'Apenas clientes podem assinar planos' }); return }
  if (!user.email) { res.status(400).json({ message: 'Sua conta precisa de e-mail para assinar' }); return }
  const planId = z.object({ planId: z.string().uuid() }).parse(req.body).planId
  const plan = await prisma.membershipPlan.findFirst({ where: { id: planId, barbershopId: req.barbershop!.id, active: true } })
  if (!plan) { res.status(404).json({ message: 'Plano não encontrado' }); return }
  const existing = await prisma.customerSubscription.findFirst({ where: { barbershopId: req.barbershop!.id, userId: user.id, status: { in: ['ACTIVE', 'PAST_DUE'] } } })
  if (existing) { res.status(409).json({ message: 'Você já possui uma assinatura neste estabelecimento' }); return }
  const now = new Date()
  const customerSubscription = await prisma.customerSubscription.create({
    data: {
      barbershopId: req.barbershop!.id, userId: user.id, planId: plan.id, status: 'PAST_DUE',
      currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + plan.intervalDays * 86_400_000),
    },
  })
  try {
    const subscription = await mercadoPagoClient().createCustomerSubscription({
      subscriptionId: customerSubscription.id, planName: plan.name, priceCents: plan.priceCents,
      intervalDays: plan.intervalDays, payerEmail: user.email, backUrl: `${frontendUrl()}/cliente/perfil?membership=return`,
    })
    await prisma.customerSubscription.update({ where: { id: customerSubscription.id }, data: { mercadoPagoSubscriptionId: subscription.id } })
    res.status(201).json({ checkoutUrl: subscription.initPoint, subscription: { ...customerSubscription, plan } })
  } catch (error) {
    await prisma.customerSubscription.delete({ where: { id: customerSubscription.id } })
    throw error
  }
})

router.get('/me', async (req, res) => {
  const user = req.user as SessionUser
  const subscription = await prisma.customerSubscription.findFirst({
    where: { barbershopId: req.barbershop!.id, userId: user.id }, include: { plan: true }, orderBy: { createdAt: 'desc' },
  })
  res.json(subscription)
})

router.get('/', requireBarbershopRole('OWNER', 'ADMIN'), async (req, res) => {
  res.json(await prisma.customerSubscription.findMany({
    where: { barbershopId: req.barbershop!.id }, include: { plan: true, user: { select: { id: true, name: true, email: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  }))
})

router.post('/:id/cancel', async (req, res) => {
  const id = z.string().uuid().parse(req.params.id)
  const user = req.user as SessionUser
  const subscription = await prisma.customerSubscription.findFirst({ where: { id, barbershopId: req.barbershop!.id } })
  if (!subscription) { res.status(404).json({ message: 'Assinatura não encontrada' }); return }
  if (subscription.userId !== user.id) {
    const membership = await prisma.membership.findUnique({ where: { barbershopId_userId: { barbershopId: req.barbershop!.id, userId: user.id } } })
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) { res.status(403).json({ message: 'Acesso negado para esta assinatura' }); return }
  }
  if (subscription.mercadoPagoSubscriptionId) await mercadoPagoClient().updateSubscriptionStatus(subscription.mercadoPagoSubscriptionId, 'cancelled')
  const updated = await prisma.customerSubscription.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } })
  await prisma.recurringBooking.updateMany({ where: { subscriptionId: id }, data: { active: false } })
  res.json(updated)
})

export { router as subscriptionsRoutes }
