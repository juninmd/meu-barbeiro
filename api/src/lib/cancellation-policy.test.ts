import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cancellationQuote, cancellationReasonError } from './cancellation-policy.js'

describe('cancellation policy', () => {
  const scheduledAt = new Date('2026-08-10T15:00:00.000Z')

  it('refunds the full deposit outside the window', () => {
    assert.deepEqual(cancellationQuote({
      scheduledAt,
      cancelledAt: new Date('2026-08-10T08:59:59.000Z'),
      cancellationWindowHours: 6,
      lateCancellationFeeBps: 2_500,
      paidDepositCents: 5_001,
      cancelledByRole: 'CUSTOMER',
    }), { hoursBefore: 7, late: false, refundedCents: 5_001, feeCents: 0 })
  })

  it('retains the configured share inside the window without losing a cent', () => {
    const quote = cancellationQuote({
      scheduledAt,
      cancelledAt: new Date('2026-08-10T09:00:01.000Z'),
      cancellationWindowHours: 6,
      lateCancellationFeeBps: 3_333,
      paidDepositCents: 5_001,
      cancelledByRole: 'CUSTOMER',
    })
    assert.deepEqual(quote, { hoursBefore: 6, late: true, refundedCents: 3_334, feeCents: 1_667 })
    assert.equal(quote.refundedCents + quote.feeCents, 5_001)
  })

  it('always refunds cancellations made by the barbershop', () => {
    for (const cancelledByRole of ['BARBER', 'OWNER', 'ADMIN'] as const) {
      assert.deepEqual(cancellationQuote({
        scheduledAt,
        cancelledAt: new Date('2026-08-10T14:45:00.000Z'),
        cancellationWindowHours: 24,
        lateCancellationFeeBps: 10_000,
        paidDepositCents: 5_000,
        cancelledByRole,
      }), { hoursBefore: 1, late: true, refundedCents: 5_000, feeCents: 0 })
    }
  })

  it('keeps the previous full-refund behavior with a zero policy or no paid deposit', () => {
    assert.equal(cancellationQuote({ scheduledAt, cancelledAt: scheduledAt, cancellationWindowHours: 0, lateCancellationFeeBps: 0, paidDepositCents: 5_000, cancelledByRole: 'CUSTOMER' }).refundedCents, 5_000)
    assert.deepEqual(cancellationQuote({ scheduledAt, cancelledAt: scheduledAt, cancellationWindowHours: 24, lateCancellationFeeBps: 10_000, paidDepositCents: 0, cancelledByRole: 'CUSTOMER' }), { hoursBefore: 0, late: true, refundedCents: 0, feeCents: 0 })
  })

  it('requires a reason only from the barbershop', () => {
    assert.equal(cancellationReasonError('CUSTOMER', undefined), null)
    assert.equal(cancellationReasonError('BARBER', '  '), 'Informe o motivo do cancelamento')
    assert.equal(cancellationReasonError('OWNER', 'Barbeiro indisponível'), null)
  })
})
