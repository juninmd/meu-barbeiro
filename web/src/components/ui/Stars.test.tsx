// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { StarInput } from './Stars'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mountedRoots: ReturnType<typeof createRoot>[] = []

afterEach(() => {
  mountedRoots.forEach((root) => act(() => root.unmount()))
  mountedRoots.length = 0
  document.body.innerHTML = ''
})

function Harness({ initial }: { initial: number }) {
  const [value, setValue] = useState(initial)
  return <StarInput value={value} onChange={setValue} />
}

const mount = (initial: number) => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  act(() => root.render(<Harness initial={initial} />))
  return [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
}

const press = (key: string) => act(() => {
  document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
})

describe('StarInput', () => {
  it('moves focus to the newly checked star on arrow keys (roving tabindex)', () => {
    const radios = mount(3)
    act(() => radios[2]!.focus())

    press('ArrowRight')
    expect(radios[3]!.getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(radios[3])

    press('ArrowLeft')
    press('ArrowLeft')
    expect(radios[1]!.getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(radios[1])
  })

  it('keeps focus in range at the edges', () => {
    const radios = mount(5)
    act(() => radios[4]!.focus())
    press('ArrowRight')
    expect(document.activeElement).toBe(radios[4])
  })
})
