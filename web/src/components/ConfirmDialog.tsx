import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

interface ConfirmDialogProps {
  eyebrow: string
  title: ReactNode
  description: ReactNode
  cancelLabel: string
  confirmLabel: string
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: () => void
}

const focusableSelector = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

export function ConfirmDialog({
  eyebrow,
  title,
  description,
  cancelLabel,
  confirmLabel,
  busy = false,
  error,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const dialog = useRef<HTMLElement>(null)
  const safeButton = useRef<HTMLButtonElement>(null)
  const busyRef = useRef(busy)
  const onCancelRef = useRef(onCancel)
  const titleId = useId()
  const descriptionId = useId()
  busyRef.current = busy
  onCancelRef.current = onCancel

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    safeButton.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        onCancelRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])]
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) {
        event.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  return (
    <div className="dialog-backdrop">
      <section
        ref={dialog}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="confirmation-dialog"
        role="dialog"
      >
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        {error && <p className="form-message" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button ref={safeButton} className="button button-ghost" disabled={busy} onClick={onCancel} type="button">
            {cancelLabel}
          </button>
          <button className="button button-danger" disabled={busy} onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
