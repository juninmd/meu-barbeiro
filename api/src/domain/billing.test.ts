import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_COMMISSION_BPS,
  DEFAULT_MONTHLY_FEE_CENTS,
  calculateCommissionCents,
  calculateDepositCents,
} from './billing.js'

describe('billing rules', () => {
  it('charges R$ 20,00 monthly by default', () => {
    assert.equal(DEFAULT_MONTHLY_FEE_CENTS, 2_000)
  })

  it('charges exactly 1% of the service value rounded to cents', () => {
    assert.equal(DEFAULT_COMMISSION_BPS, 100)
    assert.equal(calculateCommissionCents(5_500), 55)
    assert.equal(calculateCommissionCents(5_599), 56)
  })

  it('supports full, percentage, fixed and disabled deposits', () => {
    assert.equal(calculateDepositCents(8_500, { type: 'FULL', value: 0 }), 8_500)
    assert.equal(calculateDepositCents(8_500, { type: 'PERCENTAGE', value: 30 }), 2_550)
    assert.equal(calculateDepositCents(8_500, { type: 'FIXED', value: 2_000 }), 2_000)
    assert.equal(calculateDepositCents(8_500, { type: 'NONE', value: 0 }), 0)
  })

  it('never lets a fixed deposit exceed the service value', () => {
    assert.equal(calculateDepositCents(5_000, { type: 'FIXED', value: 7_000 }), 5_000)
  })

  it('rejects invalid money and deposit configuration', () => {
    assert.throws(() => calculateCommissionCents(-1), /valor do serviço/i)
    assert.throws(() => calculateDepositCents(5_000, { type: 'PERCENTAGE', value: 101 }), /percentual/i)
    assert.throws(() => calculateDepositCents(5_000, { type: 'FIXED', value: -1 }), /sinal fixo/i)
  })
})
