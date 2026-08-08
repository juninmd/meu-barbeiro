export type CancellationRole = 'CUSTOMER' | 'BARBER' | 'OWNER' | 'ADMIN'

interface CancellationQuoteInput {
  scheduledAt: Date
  cancelledAt: Date
  cancellationWindowHours: number
  lateCancellationFeeBps: number
  paidDepositCents: number
  cancelledByRole: CancellationRole
}

export interface CancellationQuote {
  hoursBefore: number
  late: boolean
  refundedCents: number
  feeCents: number
}

export function cancellationQuote(input: CancellationQuoteInput): CancellationQuote {
  const millisecondsBefore = Math.max(0, input.scheduledAt.getTime() - input.cancelledAt.getTime())
  const hoursBefore = Math.ceil(millisecondsBefore / 3_600_000)
  const late = input.cancellationWindowHours > 0
    && millisecondsBefore <= input.cancellationWindowHours * 3_600_000
  const customerFeeApplies = input.cancelledByRole === 'CUSTOMER' && late
  const feeCents = customerFeeApplies
    ? Math.round(input.paidDepositCents * input.lateCancellationFeeBps / 10_000)
    : 0
  return {
    hoursBefore,
    late,
    feeCents,
    refundedCents: input.paidDepositCents - feeCents,
  }
}

export function cancellationReasonError(role: CancellationRole, reason: string | undefined): string | null {
  return role !== 'CUSTOMER' && !reason?.trim() ? 'Informe o motivo do cancelamento' : null
}
