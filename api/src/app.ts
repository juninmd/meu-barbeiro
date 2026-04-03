import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import session from 'express-session'
import { passport } from './lib/passport'
import { servicesRoutes } from './routes/services.routes'
import { appointmentsRoutes } from './routes/appointments.routes'
import { authRoutes } from './routes/auth.routes'

dotenv.config()

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false
}))

app.use(passport.initialize())
app.use(passport.session())

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/auth', authRoutes)
app.use('/services', servicesRoutes)
app.use('/appointments', appointmentsRoutes)

export { app }
