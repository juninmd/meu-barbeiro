// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mountedRoots: ReturnType<typeof createRoot>[] = []

afterEach(() => {
  mountedRoots.forEach((root) => act(() => root.unmount()))
  mountedRoots.length = 0
  document.body.innerHTML = ''
})

// Radix usa portal e agenda foco/retorno em timers: esperamos o ciclo terminar.
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })

const mountDialog = (onCancel = () => undefined) => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  act(() => root.render(
    <ConfirmDialog
      eyebrow="Confirmação"
      title="Confirmar ação?"
      description="Esta ação terá efeito imediato."
      cancelLabel="Voltar"
      confirmLabel="Confirmar"
      onCancel={onCancel}
      onConfirm={() => undefined}
    />,
  ))
  return container
}

describe('ConfirmDialog', () => {
  it('starts on the safe button and traps focus in both Tab directions', async () => {
    mountDialog()
    await settle()
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    const [safeButton, confirmButton] = [...dialog.querySelectorAll('button')]

    expect(document.activeElement).toBe(safeButton)
    confirmButton?.focus()
    act(() => { dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })) })
    expect(document.activeElement).toBe(safeButton)
    safeButton?.focus()
    act(() => { dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })) })
    expect(document.activeElement).toBe(confirmButton)
  })

  it('closes with Escape and restores focus to the opener', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    mountedRoots.push(root)

    function Harness() {
      const [open, setOpen] = useState(true)
      return open ? (
        <ConfirmDialog
          eyebrow="Confirmação"
          title="Confirmar ação?"
          description="Esta ação terá efeito imediato."
          cancelLabel="Voltar"
          confirmLabel="Confirmar"
          onCancel={() => setOpen(false)}
          onConfirm={() => undefined}
        />
      ) : null
    }

    act(() => root.render(<Harness />))
    await settle()
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    await settle()

    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('renders an operation error inside the dialog', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    mountedRoots.push(root)
    act(() => root.render(
      <ConfirmDialog
        eyebrow="Confirmação"
        title="Confirmar ação?"
        description="Esta ação terá efeito imediato."
        cancelLabel="Voltar"
        confirmLabel="Confirmar"
        error="Não foi possível concluir"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    ))

    await settle()
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toBe('Não foi possível concluir')
  })
})
