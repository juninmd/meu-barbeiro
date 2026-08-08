import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { dateAtLocalTime } from '../lib/schedule.js'
import { buildCancellationReport } from '../lib/cancellation-report.js'
import { requireUser, type SessionUser } from '../middleware/auth.js'
import { requireBarbershopRole, resolveBarbershop } from '../middleware/barbershop.js'

const router = Router()
const reportRoles = requireBarbershopRole('OWNER', 'ADMIN', 'BARBER')
const dateSchema = z.iso.date()

router.use(requireUser, resolveBarbershop)

router.get('/cancellations', reportRoles, async (req, res) => {
  const input = z.object({ from: dateSchema, to: dateSchema }).parse(req.query)
  if (input.from > input.to || daysBetween(input.from, input.to) > 366) {
    res.status(400).json({ message: 'O período deve ter no máximo 366 dias' })
    return
  }
  const user = req.user as SessionUser
  const barbershop = req.barbershop!
  const range = reportRange(input.from, input.to, barbershop.timezone)
  const cancellations = await prisma.appointmentCancellation.findMany({
    where: {
      barbershopId: barbershop.id,
      createdAt: { gte: range.start, lt: range.end },
      ...(req.membership!.role === 'BARBER' ? { appointment: { barberId: user.id } } : {}),
    },
    select: {
      cancelledByRole: true,
      hoursBefore: true,
      feeCents: true,
      appointment: {
        select: {
          scheduledAt: true,
          service: { select: { priceCents: true } },
          user: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(buildCancellationReport({
    ...input,
    timezone: barbershop.timezone,
    cancellationWindowHours: barbershop.cancellationWindowHours,
    cancellations,
  }))
})

router.get('/daily', reportRoles, async (req, res) => {
  const { date } = z.object({ date: dateSchema }).parse(req.query)
  res.json(await loadReport(req, date, date))
})

router.get('/summary', reportRoles, async (req, res) => {
  const input = z.object({ from: dateSchema, to: dateSchema }).parse(req.query)
  if (input.from > input.to || daysBetween(input.from, input.to) > 366) {
    res.status(400).json({ message: 'O período deve ter no máximo 366 dias' })
    return
  }
  res.json(await loadReport(req, input.from, input.to))
})

async function loadReport(req: Express.Request, from: string, to: string) {
  const user = req.user as SessionUser
  const barbershop = req.barbershop!
  const range = reportRange(from, to, barbershop.timezone)
  const barberFilter = req.membership!.role === 'BARBER' ? { barberId: user.id } : {}
  const sellerFilter = req.membership!.role === 'BARBER' ? { soldById: user.id } : {}
  const [appointments, sales, memberships] = await Promise.all([
    prisma.appointment.findMany({
      where: { barbershopId: barbershop.id, scheduledAt: { gte: range.start, lt: range.end }, ...barberFilter },
      select: {
        id: true, barberId: true, status: true, commissionCents: true,
        barber: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, priceCents: true } },
      },
    }),
    prisma.productSale.findMany({
      where: { barbershopId: barbershop.id, createdAt: { gte: range.start, lt: range.end }, ...sellerFilter },
      select: {
        quantity: true, unitPriceCents: true, soldById: true,
        soldBy: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
      },
    }),
    prisma.membership.findMany({
      where: {
        barbershopId: barbershop.id,
        role: { in: ['OWNER', 'ADMIN', 'BARBER'] },
        ...(req.membership!.role === 'BARBER' ? { userId: user.id } : {}),
      },
      select: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
  ])
  const people = new Map(memberships.map((item) => [item.user.id, item.user]))
  for (const appointment of appointments) people.set(appointment.barber.id, appointment.barber)
  for (const sale of sales) people.set(sale.soldBy.id, sale.soldBy)
  return buildReport({ from, to, timezone: barbershop.timezone, appointments, sales, members: [...people.values()] })
}

interface ReportAppointment {
  barberId: string
  status: string
  commissionCents: number
  barber: { id: string; name: string }
  service: { id: string; name: string; priceCents: number }
}

interface ReportSale {
  quantity: number
  unitPriceCents: number
  soldById: string
  soldBy: { id: string; name: string }
  product: { id: string; name: string }
}

export function buildReport(input: {
  from: string
  to: string
  timezone: string
  appointments: ReportAppointment[]
  sales: ReportSale[]
  members: Array<{ id: string; name: string }>
}) {
  const done = input.appointments.filter((item) => item.status === 'DONE')
  const services = rankedItems(done.map((item) => ({ id: item.service.id, name: item.service.name, quantity: 1, revenueCents: item.service.priceCents })))
  const products = rankedItems(input.sales.map((item) => ({
    id: item.product.id, name: item.product.name, quantity: item.quantity,
    revenueCents: item.quantity * item.unitPriceCents,
  })))
  const byBarber = input.members.map((member) => {
    const barberAppointments = done.filter((item) => item.barberId === member.id)
    const barberSales = input.sales.filter((item) => item.soldById === member.id)
    const serviceRevenueCents = barberAppointments.reduce((total, item) => total + item.service.priceCents, 0)
    const productRevenueCents = barberSales.reduce((total, item) => total + item.quantity * item.unitPriceCents, 0)
    const platformCommissionCents = barberAppointments.reduce((total, item) => total + item.commissionCents, 0)
    return {
      barber: member,
      completedAppointments: barberAppointments.length,
      serviceRevenueCents,
      productsSold: barberSales.reduce((total, item) => total + item.quantity, 0),
      productRevenueCents,
      platformCommissionCents,
      netRevenueCents: serviceRevenueCents + productRevenueCents - platformCommissionCents,
    }
  })
  const serviceRevenueCents = done.reduce((total, item) => total + item.service.priceCents, 0)
  const productRevenueCents = input.sales.reduce((total, item) => total + item.quantity * item.unitPriceCents, 0)
  const platformCommissionCents = done.reduce((total, item) => total + item.commissionCents, 0)
  return {
    period: { from: input.from, to: input.to, timezone: input.timezone },
    cashBasis: 'DONE_ONLY' as const,
    notice: 'O faturamento considera apenas atendimentos concluídos (DONE); agendados e confirmados não são caixa.',
    byBarber,
    noShows: input.appointments.filter((item) => item.status === 'NO_SHOW').length,
    cancellations: input.appointments.filter((item) => item.status === 'CANCELLED').length,
    averageTicketCents: done.length ? Math.round(serviceRevenueCents / done.length) : 0,
    topServices: services,
    topProducts: products,
    totals: {
      completedAppointments: done.length,
      serviceRevenueCents,
      productsSold: input.sales.reduce((total, item) => total + item.quantity, 0),
      productRevenueCents,
      grossRevenueCents: serviceRevenueCents + productRevenueCents,
      platformCommissionCents,
      netRevenueCents: serviceRevenueCents + productRevenueCents - platformCommissionCents,
    },
  }
}

function rankedItems(items: Array<{ id: string; name: string; quantity: number; revenueCents: number }>) {
  const grouped = new Map<string, { id: string; name: string; quantity: number; revenueCents: number }>()
  for (const item of items) {
    const current = grouped.get(item.id)
    grouped.set(item.id, current
      ? { ...current, quantity: current.quantity + item.quantity, revenueCents: current.revenueCents + item.revenueCents }
      : { ...item })
  }
  return [...grouped.values()].sort((left, right) => right.quantity - left.quantity || right.revenueCents - left.revenueCents)
}

export function reportRange(from: string, to: string, timezone: string) {
  return { start: dateAtLocalTime(from, '00:00', timezone), end: dateAtLocalTime(nextDate(to), '00:00', timezone) }
}

function nextDate(value: string) {
  const date = new Date(`${value}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00.000Z`) - Date.parse(`${from}T12:00:00.000Z`)) / 86_400_000)
}

export { router as reportsRoutes }
