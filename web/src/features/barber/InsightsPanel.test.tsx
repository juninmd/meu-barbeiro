// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { InsightsPanel } from './InsightsPanel'
import type { Appointment } from '../../types'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const roots: ReturnType<typeof createRoot>[] = []

afterEach(() => {
  roots.forEach((root) => act(() => root.unmount()))
  roots.length = 0
  document.body.innerHTML = ''
})

const at = (hour: number) => ({
  id: `a-${hour}`, userId: 'u1', status: 'CONFIRMED', scheduledAt: new Date(2026, 10, 10, hour).toISOString(), service: { price: 50 },
}) as unknown as Appointment

const headers = (appointments: Appointment[]) => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  act(() => root.render(<InsightsPanel appointments={appointments} />))
  return [...container.querySelectorAll('#occupancy-title ~ * thead th, thead th')].map((th) => th.textContent?.trim()).filter((text) => text?.endsWith('h'))
}

describe('InsightsPanel occupancy heatmap', () => {
  it('keeps the default 9h-20h grid', () => {
    const hours = headers([at(10)])
    expect(hours[0]).toBe('9h')
    expect(hours.at(-1)).toBe('20h')
  })

  it('widens the grid for appointments outside the default hours', () => {
    const hours = headers([at(7), at(22)])
    expect(hours[0]).toBe('7h')
    expect(hours.at(-1)).toBe('22h')
  })
})
