import express from 'express'
import cors from 'cors'
import session from 'express-session'
import { passport } from './lib/passport.js'
import { servicesRoutes } from './routes/services.routes.js'
import { appointmentsRoutes } from './routes/appointments.routes.js'
import { authRoutes } from './routes/auth.routes.js'
import { barbersRoutes } from './routes/barbers.routes.js'
import { barbershopsRoutes } from './routes/barbershops.routes.js'
import { billingRoutes } from './routes/billing.routes.js'
import { devRoutes } from './routes/dev.routes.js'
import { productsRoutes } from './routes/products.routes.js'
import { customersRoutes } from './routes/customers.routes.js'
import { loyaltyRoutes } from './routes/loyalty.routes.js'
import { reportsRoutes } from './routes/reports.routes.js'
import { errorHandler } from './middleware/errors.js'
import { PrismaSessionStore } from './lib/session-store.js'

const app = express()
const sessionSecret = process.env.SESSION_SECRET

if (process.env.NODE_ENV === 'production' && !sessionSecret) {
  throw new Error('SESSION_SECRET is required in production')
}

app.set('trust proxy', 1)

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())

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

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

if (process.env.ENABLE_DEV_LOGIN === 'true' && process.env.NODE_ENV !== 'production') {
  app.use('/dev', devRoutes)
  console.warn('ENABLE_DEV_LOGIN=true — rotas /dev habilitadas (uso local apenas)')
}

app.use('/auth', authRoutes)
app.use('/barbershops', barbershopsRoutes)
app.use('/billing/mercado-pago', billingRoutes)
app.use('/services', servicesRoutes)
app.use('/products', productsRoutes)
app.use('/barbers', barbersRoutes)
app.use('/customers', customersRoutes)
app.use('/appointments', appointmentsRoutes)
app.use('/reports', reportsRoutes)
app.use('/loyalty', loyaltyRoutes)
app.use(errorHandler)

export { app }
