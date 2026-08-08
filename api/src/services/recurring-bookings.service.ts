import { calculateCommissionCents, calculateDepositCents } from '../domain/billing.js'
import { membershipBenefit, nextRecurringDates, normalizeSubscriptionPeriod } from '../lib/customer-membership.js'
import { mercadoPagoClient, sellerAccessToken } from '../lib/mercado-pago-config.js'
import { prisma } from '../lib/prisma.js'
import { dateAtLocalTime, validateAppointmentSchedule } from '../lib/schedule.js'

export async function processRecurringBookings(now = new Date()): Promise<{ created: number; pending: number; skipped: number }> {
  const bookings = await prisma.recurringBooking.findMany({
    where: { active: true, subscription: { status: 'ACTIVE' } },
    include: { subscription: { include: { plan: true } }, barbershop: { include: { businessHours: true } }, user: true, barber: true },
  })
  const result = { created: 0, pending: 0, skipped: 0 }
  for (const booking of bookings) {
    for (const date of nextRecurringDates(now, booking.weekday, 4)) {
      const scheduledAt = dateAtLocalTime(date.toISOString().slice(0, 10), booking.time, booking.barbershop.timezone)
      if (scheduledAt <= now) { result.skipped += 1; continue }
      const existing = await prisma.recurringBookingOccurrence.findUnique({
        where: { recurringBookingId_scheduledAt: { recurringBookingId: booking.id, scheduledAt } },
      })
      if (existing) { result.skipped += 1; continue }
      const services = await prisma.service.findMany({
        where: { barbershopId: booking.barbershopId, id: { in: booking.serviceIds }, active: true },
      })
      if (services.length !== new Set(booking.serviceIds).size) {
        await recordPending(booking, scheduledAt, 'Um serviço do horário fixo não está mais disponível', now)
        result.pending += 1
        continue
      }
      const [scheduled, holidays, schedule, absences] = await Promise.all([
        prisma.appointment.findMany({
          where: { barbershopId: booking.barbershopId, barberId: booking.barberId, status: { in: ['PENDING', 'CONFIRMED'] } },
          include: { service: true },
        }),
        prisma.holiday.findMany({ where: { barbershopId: booking.barbershopId }, select: { date: true, description: true } }),
        prisma.barberSchedule.findMany({ where: { barbershopId: booking.barbershopId, barberId: booking.barberId } }),
        prisma.barberAbsence.findMany({ where: { barbershopId: booking.barbershopId, barberId: booking.barberId } }),
      ])
      const duration = services.reduce((total, service) => total + service.duration, 0)
      const error = validateAppointmentSchedule({
        scheduledAt, duration, timezone: booking.barbershop.timezone, businessHours: booking.barbershop.businessHours,
        holidays, barberSchedule: schedule, absences,
        scheduled: scheduled.map((item) => ({ id: item.id, scheduledAt: item.scheduledAt, duration: item.service.duration })),
        now,
      })
      if (error) {
        const reason = error.code === 'conflict' ? 'Conflito com agendamento avulso já existente' : error.message
        await recordPending(booking, scheduledAt, reason, now)
        result.pending += 1
        continue
      }
      const period = normalizeSubscriptionPeriod(booking.subscription, booking.subscription.plan.intervalDays, now)
      if (period.currentPeriodStart.getTime() !== booking.subscription.currentPeriodStart.getTime()) {
        await prisma.customerSubscription.update({ where: { id: booking.subscription.id }, data: period })
      }
      const benefit = membershipBenefit({ ...booking.subscription, ...period }, booking.subscription.plan, services[0]!.id, now)
      const covered = benefit.covered && (await prisma.customerSubscription.updateMany({
        where: { id: booking.subscription.id, status: 'ACTIVE', visitsUsed: period.visitsUsed }, data: { visitsUsed: { increment: 1 } },
      })).count === 1
      const depositPolicy = { type: booking.barbershop.depositType, value: booking.barbershop.depositValue }
      const priceCents = services.reduce((total, service) => total + service.priceCents, 0)
      const paymentAmountCents = covered ? 0 : calculateDepositCents(priceCents, depositPolicy)
      const appointment = await prisma.appointment.create({
        data: {
          barbershopId: booking.barbershopId, userId: booking.userId, barberId: booking.barberId,
          serviceId: services[0]!.id, scheduledAt, status: 'PENDING', recurringBookingId: booking.id,
          ...(covered ? { customerSubscriptionId: booking.subscription.id } : {}),
          paymentStatus: paymentAmountCents > 0 ? 'PENDING' : 'NOT_REQUIRED', paymentAmountCents,
          commissionCents: paymentAmountCents > 0 ? calculateCommissionCents(priceCents, booking.barbershop.commissionBps) : 0,
          paymentExpiresAt: paymentAmountCents > 0 ? new Date(scheduledAt.getTime() - 60 * 60_000) : null,
        },
      })
      await prisma.recurringBookingOccurrence.create({
        data: { barbershopId: booking.barbershopId, recurringBookingId: booking.id, scheduledAt, status: 'CREATED', appointmentId: appointment.id },
      })
      if (paymentAmountCents > 0 && booking.barbershop.mercadoPagoSellerId) {
        const checkout = await mercadoPagoClient().createMarketplaceCheckout({
          sellerAccessToken: await sellerAccessToken(booking.barbershop), appointmentId: appointment.id,
          serviceName: services.map((service) => service.name).join(' + '), servicePriceCents: priceCents,
          depositPolicy, ...(booking.user.email ? { payerEmail: booking.user.email } : {}),
          frontendBaseUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
          webhookUrl: `${process.env.API_PUBLIC_URL || 'http://localhost:3333'}/billing/mercado-pago/webhook`,
        })
        await prisma.appointment.update({ where: { id: appointment.id }, data: { mercadoPagoPreferenceId: checkout.id } })
        await enqueueMessage(booking.barbershopId, booking.userId, `Seu horário fixo excedeu as visitas incluídas. Pague o sinal: ${checkout.initPoint}`, `recurring-payment:${appointment.id}`, now)
      }
      result.created += 1
    }
  }
  return result
}

async function recordPending(
  booking: { id: string; barbershopId: string; userId: string; barberId: string },
  scheduledAt: Date,
  reason: string,
  now: Date,
): Promise<void> {
  await prisma.recurringBookingOccurrence.create({
    data: { barbershopId: booking.barbershopId, recurringBookingId: booking.id, scheduledAt, status: 'PENDING', reason },
  })
  const message = `Horário fixo não criado para ${scheduledAt.toISOString()}: ${reason}. Entre em contato para remarcar.`
  await Promise.all([
    enqueueMessage(booking.barbershopId, booking.userId, message, `recurring-failure:${booking.id}:${scheduledAt.toISOString()}:customer`, now),
    enqueueMessage(booking.barbershopId, booking.barberId, message, `recurring-failure:${booking.id}:${scheduledAt.toISOString()}:barber`, now),
  ])
}

async function enqueueMessage(barbershopId: string, recipientId: string, message: string, key: string, now: Date): Promise<void> {
  await prisma.appointmentReminder.create({
    data: { recipientId, barbershopId, kind: 'staff:recurring-booking', channel: 'telegram', deduplicationKey: key, message, availableAt: now, sentAt: now },
  })
}
