import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errors.js'
import { buildReport, reportRange, reportsRoutes } from './reports.routes.js'

const originals = {
  findBarbershop: prisma.barbershop.findUnique,
  findMembership: prisma.membership.findUnique,
  findMemberships: prisma.membership.findMany,
  findAppointments: prisma.appointment.findMany,
  findSales: prisma.productSale.findMany,
}

const barber = { id: 'barber-1', name: 'Rafael' }
const service = { id: 'service-1', name: 'Corte', priceCents: 5_005 }

describe('reports', () => {
  beforeEach(() => {
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: async () => ({
      id: 'shop-1', timezone: 'America/Sao_Paulo', businessHours: [],
    }) as never })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: async () => ({ role: 'BARBER' }) as never })
  })

  afterEach(() => {
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: originals.findBarbershop })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: originals.findMembership })
    Object.defineProperty(prisma.membership, 'findMany', { configurable: true, value: originals.findMemberships })
    Object.defineProperty(prisma.appointment, 'findMany', { configurable: true, value: originals.findAppointments })
    Object.defineProperty(prisma.productSale, 'findMany', { configurable: true, value: originals.findSales })
  })

  it('counts only DONE revenue and uses the unit price recorded in each product sale', () => {
    const appointment = (status: string) => ({ barberId: barber.id, status, commissionCents: 50, barber, service })
    const report = buildReport({
      from: '2026-08-08', to: '2026-08-08', timezone: 'America/Sao_Paulo', members: [barber],
      appointments: ['DONE', 'PENDING', 'CONFIRMED', 'CANCELLED', 'NO_SHOW'].map(appointment),
      sales: [{
        quantity: 2, unitPriceCents: 1_999, soldById: barber.id, soldBy: barber,
        product: { id: 'product-1', name: 'Pomada' },
      }],
    })

    assert.equal(report.totals.completedAppointments, 1)
    assert.equal(report.totals.serviceRevenueCents, 5_005)
    assert.equal(report.totals.productRevenueCents, 3_998)
    assert.equal(report.totals.platformCommissionCents, 50)
    assert.equal(report.totals.netRevenueCents, 8_953)
    assert.equal(report.averageTicketCents, 5_005)
    assert.equal(report.noShows, 1)
    assert.equal(report.cancellations, 1)
    assert.equal(report.cashBasis, 'DONE_ONLY')
  })

  it('creates machine-timezone-independent boundaries in the barbershop timezone', () => {
    const summer = reportRange('2026-01-15', '2026-01-15', 'America/Sao_Paulo')
    assert.equal(summer.start.toISOString(), '2026-01-15T03:00:00.000Z')
    assert.equal(summer.end.toISOString(), '2026-01-16T03:00:00.000Z')
  })

  it('filters BARBER report queries to the authenticated professional', async () => {
    const seen: Array<Record<string, unknown>> = []
    Object.defineProperty(prisma.appointment, 'findMany', { configurable: true, value: async ({ where }: { where: Record<string, unknown> }) => { seen.push(where); return [] } })
    Object.defineProperty(prisma.productSale, 'findMany', { configurable: true, value: async ({ where }: { where: Record<string, unknown> }) => { seen.push(where); return [] } })
    Object.defineProperty(prisma.membership, 'findMany', { configurable: true, value: async ({ where }: { where: Record<string, unknown> }) => { seen.push(where); return [{ user: barber }] } })
    const app = express()
    app.use((req, _res, next) => { req.user = { id: barber.id, role: 'BARBER' } as Express.User; next() })
    app.use('/reports', reportsRoutes)
    app.use(errorHandler)
    const server = app.listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const address = server.address()
    assert(address && typeof address !== 'string')
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/reports/daily?date=2026-08-08`)
      assert.equal(response.status, 200)
      assert.equal(seen[0]?.barberId, barber.id)
      assert.equal(seen[1]?.soldById, barber.id)
      assert.equal(seen[2]?.userId, barber.id)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })
})
