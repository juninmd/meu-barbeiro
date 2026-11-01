import type { SaasPlan, SubscriptionSnapshot } from '../types'

/**
 * Catálogo exibido quando a API ainda não respondeu (landing e fallback).
 * A fonte de verdade é `api/src/domain/plans.ts`.
 */
export const PLAN_CATALOG: SaasPlan[] = [
  {
    id: 'STARTER',
    name: 'Essencial',
    tagline: 'Para o barbeiro que trabalha sozinho.',
    monthlyFeeCents: 4_990,
    annualFeeCents: 49_900,
    recommended: false,
    limits: { professionals: 1, units: 1, monthlyReminders: 200 },
    features: [
      'Página de agendamento com link próprio',
      'Agenda, serviços e horários',
      'Lembretes automáticos',
      'Sinal online',
      'Fechamento de caixa',
    ],
  },
  {
    id: 'PRO',
    name: 'Profissional',
    tagline: 'Para barbearias com equipe.',
    monthlyFeeCents: 8_990,
    annualFeeCents: 89_900,
    recommended: true,
    limits: { professionals: 5, units: 1, monthlyReminders: 1_000 },
    features: [
      'Tudo do Essencial',
      'Até 5 profissionais com escala',
      'Comissão por barbeiro',
      'Cartão fidelidade',
      'Clube de assinatura',
      'Relatórios de receita',
    ],
  },
  {
    id: 'SCALE',
    name: 'Escala',
    tagline: 'Para quem tem mais de uma unidade.',
    monthlyFeeCents: 14_990,
    annualFeeCents: 149_900,
    recommended: false,
    limits: { professionals: Number.POSITIVE_INFINITY, units: 5, monthlyReminders: 5_000 },
    features: [
      'Tudo do Profissional',
      'Profissionais ilimitados',
      'Até 5 unidades',
      'API e webhooks',
      'Exportação financeira',
      'Suporte prioritário',
    ],
  },
]

export const mockSubscriptionSnapshot = (): SubscriptionSnapshot => ({
  state: 'ACTIVE',
  plan: 'PRO',
  planName: 'Profissional',
  monthlyFeeCents: 8_990,
  trialEndsAt: null,
  trialDaysLeft: 0,
  isActive: true,
  isBlocked: false,
})
