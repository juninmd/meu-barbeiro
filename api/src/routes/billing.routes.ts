import { createHash, randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { encryptSellerToken, mercadoPagoClient, sellerAccessToken } from '../lib/mercado-pago-config.js'
import { resolveBarbershop, requireBarbershopRole } from '../middleware/barbershop.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'
import { parseSubscriptionReference, verifyMercadoPagoSignature } from '../integrations/mercado-pago.js'
import { SAAS_PLAN_LIST, planById, planOrDefault, subscriptionSnapshot } from '../domain/plans.js'
import { audit } from '../lib/audit.js'

const router = Router()
const frontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173'
const apiUrl = () => process.env.API_PUBLIC_URL || 'http://localhost:3333'
const planInput = z.object({ plan: z.enum(['STARTER', 'PRO', 'SCALE']) })

/** Estado comercial da barbearia, com o catálogo para a tela de assinatura. */
router.get(
  '/subscription',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN'),
  async (req, res) => {
    const barbershop = req.barbershop!
    res.json({
      subscription: subscriptionSnapshot(barbershop),
      plans: SAAS_PLAN_LIST,
      billingEmail: (req.user as SessionUser).email ?? null,
      mercadoPagoConnected: Boolean(barbershop.mercadoPagoSellerId),
      hasMercadoPagoSubscription: Boolean(barbershop.mercadoPagoSubscriptionId),
    })
  },
)

/** Troca de plano antes de assinar: não cobra, só ajusta o preço do próximo checkout. */
router.patch(
  '/plan',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN'),
  async (req, res) => {
    const barbershop = req.barbershop!
    if (barbershop.subscriptionStatus === 'ACTIVE') {
      res.status(409).json({
        message: 'Sua assinatura está ativa. Cancele antes de trocar de plano para não cobrar duas vezes.',
        code: 'ACTIVE_SUBSCRIPTION',
      })
      return
    }
    const { plan } = planInput.parse(req.body)
    const selected = planById(plan)!
    const updated = await prisma.barbershop.update({
      where: { id: barbershop.id },
      data: { plan: selected.id, monthlyFeeCents: selected.monthlyFeeCents },
    })
    await audit({
      actorId: (req.user as SessionUser).id,
      barbershopId: barbershop.id,
      action: 'subscription.plan-changed',
      metadata: { plan: selected.id, monthlyFeeCents: selected.monthlyFeeCents },
    })
    res.json({ subscription: subscriptionSnapshot(updated), plans: SAAS_PLAN_LIST })
  },
)

router.post(
  '/subscription',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN'),
  async (req, res) => {
    const user = req.user as SessionUser
    const barbershop = req.barbershop!
    if (!user.email) {
      res.status(400).json({ message: 'Sua conta precisa de e-mail para assinar' })
      return
    }
    if (barbershop.subscriptionStatus === 'ACTIVE') {
      res.status(409).json({ message: 'Assinatura já está ativa', code: 'ACTIVE_SUBSCRIPTION' })
      return
    }
    const requested = planInput.partial().parse(req.body ?? {})
    const selected = requested.plan ? planById(requested.plan) : planOrDefault(barbershop.plan)
    const amountCents = requested.plan ? selected!.monthlyFeeCents : barbershop.monthlyFeeCents
    const subscription = await mercadoPagoClient().createSaasSubscription({
      barbershopId: barbershop.id,
      payerEmail: user.email,
      backUrl: `${frontendUrl()}/?subscription=return`,
      reason: `Meu Barbeiro - plano ${selected!.name}`,
      amountCents,
    })
    await prisma.barbershop.update({
      where: { id: barbershop.id },
      data: {
        mercadoPagoSubscriptionId: subscription.id,
        subscriptionStatus: 'PENDING',
        plan: selected!.id,
        monthlyFeeCents: amountCents,
      },
    })
    res.status(201).json({
      checkoutUrl: subscription.initPoint,
      monthlyFeeCents: amountCents,
      plan: selected!.id,
    })
  },
)

router.post(
  '/subscription/cancel',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER'),
  async (req, res, next) => {
    try {
      const barbershop = req.barbershop!
      if (barbershop.mercadoPagoSubscriptionId) {
        await mercadoPagoClient().updateSubscriptionStatus(barbershop.mercadoPagoSubscriptionId, 'cancelled')
      }
      const updated = await prisma.barbershop.update({
        where: { id: barbershop.id },
        data: { subscriptionStatus: 'CANCELED', canceledAt: new Date() },
      })
      await audit({
        actorId: (req.user as SessionUser).id,
        barbershopId: barbershop.id,
        action: 'subscription.canceled',
        metadata: { mercadoPagoSubscriptionId: barbershop.mercadoPagoSubscriptionId },
      })
      res.json({ subscription: subscriptionSnapshot(updated) })
    } catch (error) {
      next(error)
    }
  },
)

router.get(
  '/connect',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN'),
  (req, res) => {
    const state = randomBytes(32).toString('base64url')
    const codeVerifier = randomBytes(48).toString('base64url')
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
    req.session.mercadoPagoOAuth = {
      barbershopId: req.barbershop!.id,
      state,
      codeVerifier,
      createdAt: Date.now(),
    }
    res.json({
      authorizationUrl: mercadoPagoClient().sellerAuthorizationUrl({
        redirectUri: `${apiUrl()}/billing/mercado-pago/callback`,
        state,
        codeChallenge,
      }),
    })
  },
)

router.get('/callback', requireUser, async (req, res) => {
  const input = z.object({ code: z.string().min(1), state: z.string().min(1) }).parse(req.query)
  const pending = req.session.mercadoPagoOAuth
  delete req.session.mercadoPagoOAuth
  if (!pending || pending.state !== input.state || pending.createdAt < Date.now() - 10 * 60_000) {
    res.redirect(`${frontendUrl()}/?mercadoPago=invalid-state`)
    return
  }
  const user = req.user as SessionUser
  const membership = await prisma.membership.findUnique({
    where: { barbershopId_userId: { barbershopId: pending.barbershopId, userId: user.id } },
  })
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    res.status(403).json({ message: 'Acesso negado para esta barbearia' })
    return
  }
  const tokens = await mercadoPagoClient().exchangeSellerAuthorization({
    code: input.code,
    redirectUri: `${apiUrl()}/billing/mercado-pago/callback`,
    codeVerifier: pending.codeVerifier,
  })
  await prisma.barbershop.update({
    where: { id: pending.barbershopId },
    data: {
      mercadoPagoSellerId: tokens.sellerId,
      mercadoPagoAccessTokenEncrypted: encryptSellerToken(tokens.accessToken),
      mercadoPagoRefreshTokenEncrypted: encryptSellerToken(tokens.refreshToken),
      mercadoPagoTokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    },
  })
  res.redirect(`${frontendUrl()}/?mercadoPago=connected`)
})

router.post(
  '/disconnect',
  requireUser,
  resolveBarbershop,
  requireBarbershopRole('OWNER', 'ADMIN'),
  async (req, res) => {
    await prisma.barbershop.update({
      where: { id: req.barbershop!.id },
      data: {
        mercadoPagoSellerId: null,
        mercadoPagoAccessTokenEncrypted: null,
        mercadoPagoRefreshTokenEncrypted: null,
        mercadoPagoTokenExpiresAt: null,
      },
    })
    res.status(204).end()
  },
)

router.post('/webhook', async (req, res, next) => {
  try {
    const body = z.object({
      id: z.union([z.string(), z.number()]).optional(),
      type: z.string(),
      action: z.string().optional(),
      user_id: z.union([z.string(), z.number()]).optional(),
      data: z.object({ id: z.union([z.string(), z.number()]) }),
    }).passthrough().parse(req.body)
    const dataId = String(req.query['data.id'] || body.data.id)
    const requestId = req.header('x-request-id') || ''
    const signature = req.header('x-signature') || ''
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || ''
    if (!secret || !verifyMercadoPagoSignature({ signature, requestId, dataId, secret })) {
      res.status(401).json({ message: 'Assinatura de webhook inválida' })
      return
    }

    const eventId = String(body.id || `${body.type}:${body.action || 'updated'}:${dataId}`)
    const payload = JSON.parse(JSON.stringify(body)) as Prisma.InputJsonValue
    const event = await prisma.webhookEvent.upsert({
      where: { provider_eventId: { provider: 'MERCADO_PAGO', eventId } },
      update: { payload },
      create: { provider: 'MERCADO_PAGO', eventId, type: body.type, payload },
    })
    if (event.processedAt) {
      res.status(200).json({ received: true })
      return
    }

    if (body.type === 'payment') await processPayment(dataId, body.user_id)
    if (body.type === 'subscription_preapproval') await processSubscription(dataId)

    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } })
    res.status(200).json({ received: true })
  } catch (error) {
    next(error)
  }
})

async function processPayment(paymentId: string, sellerId: string | number | undefined): Promise<void> {
  if (!sellerId) throw new Error('Webhook de pagamento sem vendedor')
  const barbershop = await prisma.barbershop.findUnique({ where: { mercadoPagoSellerId: String(sellerId) } })
  if (!barbershop) throw new Error('Vendedor Mercado Pago não vinculado')
  const payment = await mercadoPagoClient().getPayment(paymentId, await sellerAccessToken(barbershop))
  if (!payment.external_reference) throw new Error('Pagamento sem agendamento vinculado')
  const appointment = await prisma.appointment.findFirst({
    where: { id: payment.external_reference, barbershopId: barbershop.id },
  })
  if (!appointment) throw new Error('Agendamento do pagamento não encontrado')
  if (Math.round(payment.transaction_amount * 100) !== appointment.paymentAmountCents) {
    throw new Error('Valor pago diverge do sinal esperado')
  }
  const status = ({
    approved: 'APPROVED',
    refunded: 'REFUNDED',
    charged_back: 'REFUNDED',
    rejected: 'REJECTED',
    cancelled: 'REJECTED',
  } as const)[payment.status] ?? 'PENDING'
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { paymentStatus: status, mercadoPagoPaymentId: String(payment.id) },
  })
}

async function processSubscription(subscriptionId: string): Promise<void> {
  const subscription = await mercadoPagoClient().getSubscription(subscriptionId)
  if (!subscription.external_reference) throw new Error('Assinatura sem referência vinculada')
  const reference = parseSubscriptionReference(subscription.external_reference)
  if (reference.kind === 'customer') {
    const status = ({
      authorized: 'ACTIVE', pending: 'PAST_DUE', paused: 'PAST_DUE', cancelled: 'CANCELLED',
    } as const)[subscription.status] ?? 'PAST_DUE'
    await prisma.customerSubscription.update({
      where: { id: reference.id },
      data: { status, mercadoPagoSubscriptionId: subscription.id, ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}) },
    })
    return
  }
  const status = ({
    authorized: 'ACTIVE', pending: 'PENDING', paused: 'PAST_DUE', cancelled: 'CANCELED',
  } as const)[subscription.status] ?? 'PENDING'
  await prisma.barbershop.update({
    where: { id: reference.id },
    data: {
      subscriptionStatus: status,
      mercadoPagoSubscriptionId: subscription.id,
      ...(status === 'CANCELED' ? { canceledAt: new Date() } : { canceledAt: null }),
    },
  })
}

export { router as billingRoutes }
