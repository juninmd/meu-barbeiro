// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { repository } from '../../lib/repository'
import { ClientDashboard } from './ClientDashboard'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mountedRoots: ReturnType<typeof createRoot>[] = []

const flush = () => act(async () => {
  await new Promise((resolve) => window.setTimeout(resolve, 0))
})

describe('client barber choice', () => {
  beforeEach(() => localStorage.clear())

  afterEach(() => {
    mountedRoots.forEach((root) => act(() => root.unmount()))
    mountedRoots.length = 0
    document.body.innerHTML = ''
  })

  it('chooses the date first and disables a barber outside the schedule', async () => {
    await repository.updateBarberSchedule('barber-demo', [{
      weekday: 4, startsAt: '09:00', endsAt: '20:00', enabled: true,
    }])
    const [barbers, barbershop, services] = await Promise.all([
      repository.barbers(), repository.barbershop(), repository.services(),
    ])
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    mountedRoots.push(root)

    await act(async () => root.render(
      <MemoryRouter initialEntries={['/cliente/agendar']}>
        <Routes>
          <Route path="/cliente/:section" element={<ClientDashboard
            appointments={[]}
            barbers={barbers}
            barbershop={barbershop}
            currentUser={repository.mockUser('CUSTOMER')}
            services={services}
            onRefresh={async () => undefined}
          />} />
        </Routes>
      </MemoryRouter>,
    ))
    await flush()

    const service = container.querySelector<HTMLInputElement>('input[name="service"]')
    expect(service).not.toBeNull()
    act(() => service!.click())
    const continueButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Continuar'))
    act(() => continueButton!.click())
    expect(container.textContent).toContain('Quando?')
    expect(container.textContent).not.toContain('Qualquer barbeiro disponível')

    const date = container.querySelector<HTMLInputElement>('input[type="date"]')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(date, '2099-08-05')
      date!.dispatchEvent(new Event('input', { bubbles: true }))
      date!.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await flush()
    act(() => [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Continuar'))!.click())
    await flush()

    expect(container.textContent).toContain('Qualquer barbeiro disponível')
    const unavailable = container.querySelector<HTMLInputElement>('input[value="barber-demo"]')
    expect(unavailable?.disabled).toBe(true)
    expect(unavailable?.closest('label')?.textContent).toContain('fora da escala · atende em 06/08')
  })
})
