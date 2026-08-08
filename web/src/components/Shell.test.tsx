// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { Shell } from './Shell'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const roots: ReturnType<typeof createRoot>[] = []

afterEach(() => {
  roots.forEach((root) => act(() => root.unmount()))
  roots.length = 0
  document.body.innerHTML = ''
})

describe('Shell staff navigation', () => {
  it('shows personal settings but keeps finance hidden for a BARBER membership', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    act(() => root.render(
      <MemoryRouter initialEntries={['/barbeiro/ajustes']}>
        <Shell
          user={{ id: 'barber-1', name: 'Rafael', role: 'BARBER' }}
          barbershop={{
            id: 'shop-1', slug: 'central', name: 'Central', primaryColor: '#d99b32', timezone: 'America/Sao_Paulo',
            depositType: 'NONE', depositValue: 0, cancellationWindowHours: 0, lateCancellationFeeBps: 0, monthlyFeeCents: 2000, commissionBps: 100,
            membershipRole: 'BARBER', businessHours: [],
          }}
          onLogout={() => undefined}
          onSwitchRole={() => undefined}
        >
          <p>Conteúdo</p>
        </Shell>
      </MemoryRouter>,
    ))

    expect(container.querySelector('a[aria-label="Ajustes"]')).not.toBeNull()
    expect(container.querySelector('a[aria-label="Financeiro"]')).toBeNull()
  })
})
