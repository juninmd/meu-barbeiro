/**
 * Catálogo comercial do SaaS.
 *
 * Preços definidos a partir do benchmark de mercado descrito em
 * `docs/market-research.md`: a faixa brasileira de agenda para barbearia vai de
 * R$ 39,90 a R$ 129,90 por mês, quase sempre cobrando por profissional. O
 * Essencial fica abaixo da Trinks (R$ 110/mês) e do Booksy (R$ 99,90/mês), e o
 * Escala fica na faixa de quem precisa de equipe grande.
 */
export type PlanId = 'STARTER' | 'PRO' | 'SCALE'

export interface PlanLimits {
  /** Profissionais ativos (dono + equipe). `Infinity` = sem limite. */
  professionals: number
  /** Unidades/barbearias administradas pela mesma conta. */
  units: number
  /** Lembretes automáticos por mês. */
  monthlyReminders: number
}

export interface SaasPlan {
  id: PlanId
  name: string
  tagline: string
  monthlyFeeCents: number
  annualFeeCents: number
  recommended: boolean
  limits: PlanLimits
  features: string[]
}

export const TRIAL_DAYS = 14
export const INVITATION_TTL_DAYS = 7

export const SAAS_PLANS: Record<PlanId, SaasPlan> = {
  STARTER: {
    id: 'STARTER',
    name: 'Essencial',
    tagline: 'Para o barbeiro que trabalha sozinho e quer parar de agendar no caderno.',
    monthlyFeeCents: 4_990,
    annualFeeCents: 49_900,
    recommended: false,
    limits: { professionals: 1, units: 1, monthlyReminders: 200 },
    features: [
      'Página de agendamento com o seu link',
      'Agenda, serviços e horários de funcionamento',
      'Lembretes automáticos para reduzir faltas',
      'Sinal online para segurar o horário',
      'Relatório do dia e fechamento de caixa',
    ],
  },
  PRO: {
    id: 'PRO',
    name: 'Profissional',
    tagline: 'Para barbearias com equipe, comissão e cliente que volta.',
    monthlyFeeCents: 8_990,
    annualFeeCents: 89_900,
    recommended: true,
    limits: { professionals: 5, units: 1, monthlyReminders: 1_000 },
    features: [
      'Tudo do Essencial',
      'Até 5 profissionais com escala e ausências',
      'Comissão por barbeiro no fechamento',
      'Cartão fidelidade configurável',
      'Clube de assinatura do cliente',
      'Relatórios de receita e cancelamento',
    ],
  },
  SCALE: {
    id: 'SCALE',
    name: 'Escala',
    tagline: 'Para quem já tem mais de uma unidade ou integra com outros sistemas.',
    monthlyFeeCents: 14_990,
    annualFeeCents: 149_900,
    recommended: false,
    limits: { professionals: Number.POSITIVE_INFINITY, units: 5, monthlyReminders: 5_000 },
    features: [
      'Tudo do Profissional',
      'Profissionais ilimitados',
      'Até 5 unidades na mesma conta',
      'API e webhooks para integrar',
      'Exportação financeira',
      'Suporte prioritário e onboarding assistido',
    ],
  },
}

export const SAAS_PLAN_LIST: SaasPlan[] = [SAAS_PLANS.STARTER, SAAS_PLANS.PRO, SAAS_PLANS.SCALE]

export function planById(value: unknown): SaasPlan | null {
  if (value === 'STARTER' || value === 'PRO' || value === 'SCALE') return SAAS_PLANS[value]
  return null
}

export function planOrDefault(value: unknown): SaasPlan {
  return planById(value) ?? SAAS_PLANS.STARTER
}

export function monthlyFeeForPlan(value: unknown): number {
  return planOrDefault(value).monthlyFeeCents
}

export function trialEndsAt(now = new Date(), days = TRIAL_DAYS): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
}

export type SubscriptionState = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED' | 'INACTIVE'

export interface SubscriptionLike {
  plan: string
  subscriptionStatus: string
  trialEndsAt: Date | null
  monthlyFeeCents: number
  canceledAt?: Date | null
}

export interface SubscriptionSnapshot {
  state: SubscriptionState
  plan: PlanId
  planName: string
  monthlyFeeCents: number
  trialEndsAt: string | null
  trialDaysLeft: number
  isActive: boolean
  /** `true` quando a barbearia precisa regularizar para voltar a operar. */
  isBlocked: boolean
}

const ACTIVE_STATES: SubscriptionState[] = ['ACTIVE', 'TRIALING']

const DAY_MS = 24 * 60 * 60 * 1000

export function subscriptionSnapshot(shop: SubscriptionLike, now = new Date()): SubscriptionSnapshot {
  const plan = planOrDefault(shop.plan)
  const effectiveFee = shop.monthlyFeeCents > 0 ? shop.monthlyFeeCents : plan.monthlyFeeCents
  const trialDaysLeft = shop.trialEndsAt
    ? Math.max(0, Math.ceil((shop.trialEndsAt.getTime() - now.getTime()) / DAY_MS))
    : 0

  let state: SubscriptionState
  if (shop.subscriptionStatus === 'ACTIVE') {
    state = 'ACTIVE'
  } else if (shop.subscriptionStatus === 'CANCELED' || shop.canceledAt) {
    state = 'CANCELED'
  } else if (shop.subscriptionStatus === 'PAST_DUE') {
    state = 'PAST_DUE'
  } else if (shop.trialEndsAt && trialDaysLeft > 0) {
    state = 'TRIALING'
  } else {
    state = shop.subscriptionStatus === 'INACTIVE' ? 'INACTIVE' : 'EXPIRED'
  }

  return {
    state,
    plan: plan.id,
    planName: plan.name,
    monthlyFeeCents: effectiveFee,
    trialEndsAt: shop.trialEndsAt ? shop.trialEndsAt.toISOString() : null,
    trialDaysLeft: state === 'TRIALING' ? trialDaysLeft : 0,
    isActive: ACTIVE_STATES.includes(state),
    isBlocked: !ACTIVE_STATES.includes(state),
  }
}

/** Limite de profissionais do plano, com piso de 1 para planos desconhecidos. */
export function professionalLimit(value: unknown): number {
  return Math.max(1, planOrDefault(value).limits.professionals)
}

/** Rotas de escrita que param de funcionar quando o teste ou a assinatura vence. */
const GATED_STAFF_PREFIXES = [
  '/services',
  '/products',
  '/plans',
  '/loyalty',
  '/recurring-bookings',
  '/walk-in-queue',
  '/barbers',
  '/barbershops/current',
]

export function isSubscriptionGated(method: string, pathname: string): boolean {
  if (method !== 'POST' && method !== 'PATCH' && method !== 'PUT' && method !== 'DELETE') return false
  if (pathname.startsWith('/barbershops/current/team')) return false
  if (pathname.startsWith('/barbershops/current/invitations')) return false
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  // O dono precisa conseguir corrigir os próprios dados e convidar a equipe
  // mesmo com a assinatura vencida: sem isso ele não consegue nem regularizar.
  return GATED_STAFF_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}
