import express from 'express'
import cors from 'cors'
import session from 'express-session'
import { passport } from './lib/passport.js'
import { servicesRoutes } from './routes/services.routes.js'
import { appointmentsRoutes } from './routes/appointments.routes.js'
import { appointmentsFitNowRoutes, walkInQueueRoutes } from './routes/walk-in-queue.routes.js'
import { authRoutes } from './routes/auth.routes.js'
import { accountRoutes } from './routes/account.routes.js'
import { adminRoutes } from './routes/admin.routes.js'
import { barbersRoutes } from './routes/barbers.routes.js'
import { barbershopsRoutes } from './routes/barbershops.routes.js'
import { billingRoutes } from './routes/billing.routes.js'
import { devRoutes } from './routes/dev.routes.js'
import { productsRoutes } from './routes/products.routes.js'
import { customersRoutes } from './routes/customers.routes.js'
import { loyaltyRoutes } from './routes/loyalty.routes.js'
import { reportsRoutes } from './routes/reports.routes.js'
import { plansRoutes } from './routes/plans.routes.js'
import { subscriptionsRoutes } from './routes/subscriptions.routes.js'
import { packagesRoutes } from './routes/packages.routes.js'
import { reviewsRoutes } from './routes/reviews.routes.js'
import { recurringBookingsRoutes } from './routes/recurring-bookings.routes.js'
import { invitationsRoutes } from './routes/invitations.routes.js'
import { platformRoutes } from './routes/platform.routes.js'
import { publicRoutes } from './routes/public.routes.js'
import { errorHandler } from './middleware/errors.js'
import { requestContext, notFoundHandler } from './middleware/security.js'
import { enforceSubscription } from './middleware/subscription.js'
import { PrismaSessionStore } from './lib/session-store.js'
import { rateLimit } from './lib/rate-limit.js'
import { prisma } from './lib/prisma.js'
import { logger } from './lib/logger.js'

const app = express()
const sessionSecret = process.env.SESSION_SECRET

if (process.env.NODE_ENV === 'production' && !sessionSecret) {
  throw new Error('SESSION_SECRET is required in production')
}

// Atrás do nginx/ingress o IP real vem no X-Forwarded-For. `TRUST_PROXY=false`
// desliga quando a API é exposta diretamente.
app.set('trust proxy', process.env.TRUST_PROXY === 'false' ? false : 1)
app.disable('x-powered-by')

app.use(requestContext)

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(null, false)
  },
  credentials: true,
}))
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  next()
})
app.use(express.json({ limit: '256kb' }))

app.use(session({
  store: new PrismaSessionStore(),
  secret: sessionSecret || 'development-only-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}))

app.use(passport.initialize())
app.use(passport.session())

const startedAt = new Date()

const limitAuth = rateLimit({ windowMs: 60_000, max: 30, key: (req) => `auth:${req.ip}` })
const limitGuest = rateLimit({ windowMs: 60 * 60_000, max: 20, key: (req) => `guest:${req.ip}` })
const limitSignup = rateLimit({ windowMs: 60 * 60_000, max: 10, key: (req) => `signup:${req.ip}` })
const limitInvites = rateLimit({ windowMs: 60 * 60_000, max: 20, key: (req) => `invite:${req.ip}` })
const limitBooking = rateLimit({ windowMs: 60_000, max: 60, key: (req) => `booking:${req.ip}` })
const limitWebhook = rateLimit({ windowMs: 60_000, max: 600, key: (req) => `webhook:${req.ip}` })

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) })
})

app.get('/health/live', (_req, res) => {
  res.json({ status: 'ok' })
})

/** Prontidão para Kubernetes: só responde 200 se o banco responde. */
app.get('/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ready' })
  } catch (error) {
    logger.error('health.ready-failed', { error })
    res.status(503).json({ status: 'unavailable' })
  }
})

app.get('/health/version', (_req, res) => {
  res.json({
    version: process.env.APP_VERSION ?? '1.2.0',
    commit: process.env.GIT_COMMIT ?? 'dev',
    environment: process.env.NODE_ENV ?? 'development',
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  })
})

if (process.env.ENABLE_DEV_LOGIN === 'true' && process.env.NODE_ENV !== 'production') {
  app.use('/dev', limitAuth, devRoutes)
  logger.warn('dev-login.enabled', { message: 'rotas /dev habilitadas (uso local apenas)' })
}

app.use('/auth', limitAuth, authRoutes)
app.use('/account', accountRoutes)
app.use('/public', limitGuest, publicRoutes)
app.use('/invitations', limitGuest, invitationsRoutes)
app.use('/billing/mercado-pago/webhook', limitWebhook)
app.use('/admin', adminRoutes)
app.use('/platform', platformRoutes)

// Bloqueio comercial: roda antes dos routers para cobrir toda escrita da equipe.
app.use(enforceSubscription)

app.use('/barbershops', (req, res, next) => {
  if (req.method === 'POST' && req.path === '/') return limitSignup(req, res, next)
  if (req.path.startsWith('/current/invitations')) return limitInvites(req, res, next)
  next()
})
app.use('/barbershops', barbershopsRoutes)
app.use('/billing/mercado-pago', billingRoutes)
app.use('/services', servicesRoutes)
app.use('/products', productsRoutes)
app.use('/barbers', barbersRoutes)
app.use('/customers', customersRoutes)
app.use('/appointments', (req, res, next) => {
  if (req.method === 'POST') return limitBooking(req, res, next)
  next()
})
app.use('/appointments', appointmentsFitNowRoutes)
app.use('/appointments', appointmentsRoutes)
app.use('/walk-in-queue', walkInQueueRoutes)
app.use('/reports', reportsRoutes)
app.use('/loyalty', loyaltyRoutes)
app.use('/plans', plansRoutes)
app.use('/subscriptions', subscriptionsRoutes)
app.use('/recurring-bookings', recurringBookingsRoutes)
app.use('/reviews', reviewsRoutes)
app.use('/packages', packagesRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export { app }
