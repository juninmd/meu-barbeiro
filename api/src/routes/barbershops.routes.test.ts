import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { Prisma } from '@prisma/client'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errors.js'
import { barbershopsRoutes } from './barbershops.routes.js'

const originals = {
  findBarbershop: prisma.barbershop.findUnique,
  findMembership: prisma.membership.findUnique,
  findMembershipOrThrow: prisma.membership.findUniqueOrThrow,
  updateMembership: prisma.membership.update,
  createHoliday: prisma.holiday.create,
  transaction: prisma.$transaction,
}

const businessHours = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  opensAt: '09:00',
  closesAt: '18:00',
  enabled: true,
}))

const settings = (hour: Partial<(typeof businessHours)[number]> & {
  breakStartsAt?: string
  breakEndsAt?: string
}) => ({
  name: 'Barbearia Central',
  logoUrl: null,
  primaryColor: '#d99b32',
  address: 'Rua Central, 10',
  timezone: 'America/Sao_Paulo',
  depositType: 'NONE',
  depositValue: 0,
  cancellationWindowHours: 6,
  lateCancellationFeeBps: 2_500,
  businessHours: businessHours.map((item) => item.weekday === 2 ? { ...item, ...hour } : item),
})

const startApp = async () => {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: 'user-1', role: 'ADMIN' } as Express.User
    next()
  })
  app.use('/barbershops', barbershopsRoutes)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  return { server, url: `http://127.0.0.1:${address.port}/barbershops` }
}

describe('barbershop settings and holidays', () => {
  beforeEach(() => {
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: async () => ({
      id: 'barbershop-1',
      timezone: 'America/Sao_Paulo',
      remindersEnabled: true,
      reminderHoursBefore: [24, 2],
      cancellationWindowHours: 6,
      lateCancellationFeeBps: 2_500,
      businessHours,
    }) as never })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: async () => ({ id: 'membership-1', role: 'OWNER' }) as never })
    Object.defineProperty(prisma.membership, 'findUniqueOrThrow', { configurable: true, value: async () => ({
      notificationTypes: ['CANCELLATION', 'DAILY_SUMMARY'], dailySummaryTime: '07:00', user: { telegramId: null },
    }) as never })
    Object.defineProperty(prisma.membership, 'update', { configurable: true, value: async ({ data }: { data: Record<string, unknown> }) => ({
      ...data, user: { telegramId: null },
    }) as never })
    Object.defineProperty(prisma, '$transaction', { configurable: true, value: async () => ({
      id: 'barbershop-1',
      slug: 'barbearia-central',
      name: 'Barbearia Central',
      logoUrl: null,
      primaryColor: '#d99b32',
      address: null,
      timezone: 'America/Sao_Paulo',
      depositType: 'NONE',
      depositValue: 0,
      monthlyFeeCents: 2_000,
      commissionBps: 100,
      subscriptionStatus: 'ACTIVE',
      mercadoPagoSellerId: null,
      businessHours,
    }) as never })
  })

  afterEach(() => {
    Object.defineProperty(prisma.barbershop, 'findUnique', { configurable: true, value: originals.findBarbershop })
    Object.defineProperty(prisma.membership, 'findUnique', { configurable: true, value: originals.findMembership })
    Object.defineProperty(prisma.membership, 'findUniqueOrThrow', { configurable: true, value: originals.findMembershipOrThrow })
    Object.defineProperty(prisma.membership, 'update', { configurable: true, value: originals.updateMembership })
    Object.defineProperty(prisma.holiday, 'create', { configurable: true, value: originals.createHoliday })
    Object.defineProperty(prisma, '$transaction', { configurable: true, value: originals.transaction })
  })

  for (const testCase of [
    {
      name: 'rejects a half lunch break',
      hour: { breakStartsAt: '12:00' },
      message: 'Informe o início e o fim do almoço',
    },
    {
      name: 'rejects an inverted lunch break',
      hour: { breakStartsAt: '14:00', breakEndsAt: '13:00' },
      message: 'Início do almoço deve ser anterior ao fim',
    },
    {
      name: 'rejects a lunch break outside business hours',
      hour: { breakStartsAt: '08:00', breakEndsAt: '12:00' },
      message: 'Almoço deve estar dentro do horário de funcionamento',
    },
    {
      name: 'rejects a lunch break on a closed day',
      hour: { enabled: false, breakStartsAt: '12:00', breakEndsAt: '13:00' },
      message: 'Dia fechado não pode ter horário de almoço',
    },
  ]) {
    it(testCase.name, async () => {
      const { server, url } = await startApp()
      try {
        const response = await fetch(`${url}/current`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(settings(testCase.hour)),
        })

        assert.equal(response.status, 400)
        const body = await response.json() as { issues: Array<{ message: string }> }
        assert(body.issues.some((issue) => issue.message === testCase.message))
      } finally {
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
      }
    })
  }

  it('exposes reminder configuration in the public barbershop response', async () => {
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}/current`)

      assert.equal(response.status, 200)
      const body = await response.json() as { remindersEnabled: boolean; reminderHoursBefore: number[]; cancellationWindowHours: number; lateCancellationFeeBps: number }
      assert.equal(body.remindersEnabled, true)
      assert.deepEqual(body.reminderHoursBefore, [24, 2])
      assert.equal(body.cancellationWindowHours, 6)
      assert.equal(body.lateCancellationFeeBps, 2_500)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('lets each staff member silence selected notices and exposes the missing channel', async () => {
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}/current/notification-preferences`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notificationTypes: ['CANCELLATION'], dailySummaryTime: '06:45' }),
      })

      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), {
        notificationTypes: ['CANCELLATION'], dailySummaryTime: '06:45', telegramLinked: false,
      })
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('returns a product message when the holiday date already exists', async () => {
    Object.defineProperty(prisma.holiday, 'create', { configurable: true, value: async () => {
      throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.1.0',
        meta: { target: ['barbershopId', 'date'] },
      })
    } })
    const { server, url } = await startApp()
    try {
      const response = await fetch(`${url}/current/holidays`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ date: '2099-12-25', description: 'Natal' }),
      })

      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), { message: 'Já existe um feriado cadastrado nesta data' })
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  })
})
