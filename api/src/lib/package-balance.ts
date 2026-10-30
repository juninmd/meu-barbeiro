export type PackageStatus = 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED'

export interface PackageBalanceInput {
  sessionsTotal: number
  sessionsUsed: number
  expiresAt: Date
}

/** Esgotado vence expirado: sem sessões não há o que usar, mesmo vencido. */
export function packageStatus(item: PackageBalanceInput, now = new Date()): PackageStatus {
  if (item.sessionsUsed >= item.sessionsTotal) return 'EXHAUSTED'
  if (item.expiresAt.getTime() <= now.getTime()) return 'EXPIRED'
  return 'ACTIVE'
}

export const remainingSessions = (item: Pick<PackageBalanceInput, 'sessionsTotal' | 'sessionsUsed'>) => Math.max(0, item.sessionsTotal - item.sessionsUsed)

export const expiryFrom = (start: Date, validityDays: number) => new Date(start.getTime() + validityDays * 86_400_000)
