import { describe, expect, it } from 'vitest'
import { formatBusinessHours, paymentLabel } from './format'

describe('paymentLabel', () => {
  it('uses Pagamento integral when the payment equals the service price', () => {
    expect(paymentLabel(55, 55)).toBe('Pagamento integral')
  })

  it('uses Sinal for a partial payment', () => {
    expect(paymentLabel(20, 55)).toBe('Sinal')
  })

  it('compares values rounded to cents', () => {
    expect(paymentLabel(54.999, 55.001)).toBe('Pagamento integral')
  })
})

describe('formatBusinessHours', () => {
  it('groups consecutive open days with the same hours and omits closed days', () => {
    expect(formatBusinessHours([
      { weekday: 0, opensAt: '09:00', closesAt: '20:00', enabled: false },
      { weekday: 1, opensAt: '09:00', closesAt: '20:00', enabled: true },
      { weekday: 2, opensAt: '09:00', closesAt: '20:00', enabled: true },
      { weekday: 3, opensAt: '09:00', closesAt: '20:00', enabled: true },
      { weekday: 4, opensAt: '09:00', closesAt: '20:00', enabled: true },
      { weekday: 5, opensAt: '09:00', closesAt: '20:00', enabled: true },
      { weekday: 6, opensAt: '09:00', closesAt: '14:00', enabled: true },
    ])).toBe('Seg a Sex · 09:00–20:00; Sáb · 09:00–14:00')
  })

  it('shows lunch in the customer-facing business hours summary', () => {
    expect(formatBusinessHours([
      {
        weekday: 2,
        opensAt: '09:00',
        closesAt: '18:00',
        breakStartsAt: '12:00',
        breakEndsAt: '13:00',
        enabled: true,
      },
    ])).toBe('Ter · 09:00–18:00 · almoço 12:00–13:00')
  })
})
