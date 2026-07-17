export const DEFAULT_MONTHLY_FEE_CENTS = 2_000
export const DEFAULT_COMMISSION_BPS = 100

export type DepositPolicy = {
  type: 'NONE' | 'PERCENTAGE' | 'FIXED' | 'FULL'
  value: number
}

function assertMoney(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Valor do serviço deve ser informado em centavos')
  }
}

export function calculateCommissionCents(
  servicePriceCents: number,
  commissionBps = DEFAULT_COMMISSION_BPS,
): number {
  assertMoney(servicePriceCents)
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10_000) {
    throw new Error('Comissão deve estar entre 0% e 100%')
  }
  return Math.round(servicePriceCents * commissionBps / 10_000)
}

export function calculateDepositCents(servicePriceCents: number, policy: DepositPolicy): number {
  assertMoney(servicePriceCents)

  if (policy.type === 'NONE') return 0
  if (policy.type === 'FULL') return servicePriceCents
  if (policy.type === 'PERCENTAGE') {
    if (!Number.isFinite(policy.value) || policy.value < 0 || policy.value > 100) {
      throw new Error('Percentual do sinal deve estar entre 0 e 100')
    }
    return Math.round(servicePriceCents * policy.value / 100)
  }
  if (!Number.isSafeInteger(policy.value) || policy.value < 0) {
    throw new Error('Sinal fixo deve ser informado em centavos')
  }
  return Math.min(servicePriceCents, policy.value)
}
