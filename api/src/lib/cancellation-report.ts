interface CancellationItem {
  cancelledByRole: string
  hoursBefore: number
  feeCents: number
  appointment: {
    scheduledAt: Date
    service: { priceCents: number }
    user: { id: string; name: string }
  }
}

export function buildCancellationReport(input: {
  from: string
  to: string
  timezone: string
  cancellationWindowHours: number
  cancellations: CancellationItem[]
}) {
  const byCancelledBy = { CUSTOMER: 0, BARBER: 0, OWNER: 0, ADMIN: 0 }
  const customers = new Map<string, { id: string; name: string; cancellations: number }>()
  const weekdays = new Map<number, number>()
  const hours = new Map<number, number>()
  let late = 0
  let lostRevenueCents = 0
  let retainedFeeCents = 0

  for (const cancellation of input.cancellations) {
    if (cancellation.cancelledByRole in byCancelledBy) {
      byCancelledBy[cancellation.cancelledByRole as keyof typeof byCancelledBy] += 1
    }
    if (input.cancellationWindowHours > 0 && cancellation.hoursBefore <= input.cancellationWindowHours) late += 1
    lostRevenueCents += cancellation.appointment.service.priceCents
    retainedFeeCents += cancellation.feeCents
    const customer = cancellation.appointment.user
    const current = customers.get(customer.id)
    customers.set(customer.id, { ...customer, cancellations: (current?.cancellations ?? 0) + 1 })
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: input.timezone, weekday: 'short', hour: 'numeric', hourCycle: 'h23',
    }).formatToParts(cancellation.appointment.scheduledAt)
    const weekdayName = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun'
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName)
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
    weekdays.set(weekday, (weekdays.get(weekday) ?? 0) + 1)
    hours.set(hour, (hours.get(hour) ?? 0) + 1)
  }

  const weekdayLabels = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
  return {
    period: { from: input.from, to: input.to, timezone: input.timezone },
    total: input.cancellations.length,
    byCancelledBy,
    byTiming: { late, advance: input.cancellations.length - late },
    lostRevenueCents,
    retainedFeeCents,
    topCustomers: [...customers.values()].sort((left, right) => right.cancellations - left.cancellations || left.name.localeCompare(right.name, 'pt-BR')),
    byWeekday: [...weekdays].map(([weekday, cancellations]) => ({ weekday, label: weekdayLabels[weekday]!, cancellations }))
      .sort((left, right) => right.cancellations - left.cancellations || left.weekday - right.weekday),
    byHour: [...hours].map(([hour, cancellations]) => ({ hour, label: `${hour.toString().padStart(2, '0')}h`, cancellations }))
      .sort((left, right) => right.cancellations - left.cancellations || left.hour - right.hour),
    waitlistReused: 0,
  }
}
