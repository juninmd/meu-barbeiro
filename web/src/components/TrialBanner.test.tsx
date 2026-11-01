// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { TrialBanner } from './TrialBanner'
import type { Barbershop, SubscriptionSnapshot } from '../types'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const roots: ReturnType<typeof createRoot>[] = []

afterEach(() => {
  roots.forEach((root) => act(() => root.unmount()))
  roots.length = 0
  document.body.innerHTML = ''
})

const shopWith = (subscription?: SubscriptionSnapshot): Barbershop => ({
  id: 'shop-1',
  slug: 'barbearia-central',
  name: 'Barbearia Central',
  primaryColor: '#d99b32',
  timezone: 'America/Sao_Paulo',
  depositType: 'FULL',
  depositValue: 0,
  cancellationWindowHours: 0,
  lateCancellationFeeBps: 0,
  monthlyFeeCents: 8_990,
  commissionBps: 100,
  businessHours: [],
  membershipRole: 'OWNER',
  ...(subscription ? { subscription } : {}),
})

const snapshot = (overrides: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot => ({
  state: 'TRIALING',
  plan: 'PRO',
  planName: 'Profissional',
  monthlyFeeCents: 8_990,
  trialEndsAt: '2026-11-14T12:00:00.000Z',
  trialDaysLeft: 3,
  isActive: true,
  isBlocked: false,
  ...overrides,
})

const render = (subscription?: SubscriptionSnapshot) => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  act(() => root.render(
    <MemoryRouter>
      <TrialBanner barbershop={shopWith(subscription)} />
    </MemoryRouter>,
  ))
  return container
}

describe('TrialBanner', () => {
  it('renders nothing without subscription data', () => {
    expect(render().textContent).toBe('')
  })

  it('warns when the trial is about to end', () => {
    const text = render(snapshot()).textContent ?? ''
    expect(text).toContain('3 dias de teste')
    expect(text).toContain('Ver planos')
  })

  it('stays quiet while there is plenty of trial left', () => {
    expect(render(snapshot({ trialDaysLeft: 12 })).textContent).toBe('')
  })

  it('shows the read-only alert when the subscription is blocked', () => {
    const text = render(snapshot({ state: 'EXPIRED', isActive: false, isBlocked: true, trialDaysLeft: 0 })).textContent ?? ''
    expect(text).toContain('Modo leitura')
    expect(text).toContain('Escolher plano')
  })
})
