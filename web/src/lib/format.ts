import type { BusinessHour } from '../types'

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

export const paymentLabel = (paymentAmount: number, servicePrice: number) =>
  Math.round(paymentAmount * 100) === Math.round(servicePrice * 100)
    ? 'Pagamento integral'
    : 'Sinal'

const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const dayOrder = (weekday: number) => weekday === 0 ? 7 : weekday

export const formatBusinessHours = (hours: BusinessHour[]) => {
  const groups: Array<{ start: number; end: number; opensAt: string; closesAt: string; breakStartsAt?: string | null; breakEndsAt?: string | null }> = []
  const openDays = hours
    .filter((hour) => hour.enabled)
    .sort((a, b) => dayOrder(a.weekday) - dayOrder(b.weekday))

  for (const hour of openDays) {
    const previous = groups.at(-1)
    if (
      previous
      && dayOrder(hour.weekday) === dayOrder(previous.end) + 1
      && hour.opensAt === previous.opensAt
      && hour.closesAt === previous.closesAt
      && hour.breakStartsAt === previous.breakStartsAt
      && hour.breakEndsAt === previous.breakEndsAt
    ) {
      previous.end = hour.weekday
    } else {
      groups.push({
        start: hour.weekday,
        end: hour.weekday,
        opensAt: hour.opensAt,
        closesAt: hour.closesAt,
        breakStartsAt: hour.breakStartsAt,
        breakEndsAt: hour.breakEndsAt,
      })
    }
  }

  if (groups.length === 0) return 'Fechado'
  return groups.map((group) => {
    const days = group.start === group.end
      ? dayNames[group.start]
      : `${dayNames[group.start]} a ${dayNames[group.end]}`
    const lunch = group.breakStartsAt && group.breakEndsAt
      ? ` · almoço ${group.breakStartsAt}–${group.breakEndsAt}`
      : ''
    return `${days} · ${group.opensAt}–${group.closesAt}${lunch}`
  }).join('; ')
}
