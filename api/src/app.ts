import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { servicesRoutes } from './routes/services.routes'
import { appointmentsRoutes } from './routes/appointments.routes'

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/services', servicesRoutes)
app.use('/appointments', appointmentsRoutes)

export { app }
