// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { NotificationSettings } from './NotificationSettings'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const roots: ReturnType<typeof createRoot>[] = []

afterEach(() => {
  roots.forEach((root) => act(() => root.unmount()))
  roots.length = 0
  localStorage.clear()
  document.body.innerHTML = ''
})

describe('NotificationSettings', () => {
  it('warns the barber when Telegram is not linked', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    await act(async () => root.render(<NotificationSettings />))

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Telegram não vinculado')
    expect(container.textContent).toContain('Horário do resumo diário')
  })
})
