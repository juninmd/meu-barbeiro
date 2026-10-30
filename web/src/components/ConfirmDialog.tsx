import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from './ui/Button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/Dialog'

interface ConfirmDialogProps {
  eyebrow: string
  title: ReactNode
  description: ReactNode
  cancelLabel: string
  confirmLabel: string
  busy?: boolean
  error?: string | null
  confirmDisabled?: boolean
  children?: ReactNode
  onCancel: () => void
  onConfirm: () => void
}

/** Diálogo de confirmação sobre Radix: foco preso, Esc, retorno do foco e rolagem travada vêm da biblioteca. */
export function ConfirmDialog({
  eyebrow,
  title,
  description,
  cancelLabel,
  confirmLabel,
  busy = false,
  error,
  confirmDisabled = false,
  children,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const safeButton = useRef<HTMLButtonElement>(null)
  // Sem <Trigger> do Radix, quem devolve o foco para quem abriu o diálogo somos nós.
  const [opener] = useState(() => document.activeElement instanceof HTMLElement ? document.activeElement : null)

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onCancel() }}>
      <DialogContent
        onOpenAutoFocus={(event) => { event.preventDefault(); safeButton.current?.focus() }}
        onCloseAutoFocus={(event) => { event.preventDefault(); if (opener?.isConnected) opener.focus() }}
        onEscapeKeyDown={(event) => { if (busy) event.preventDefault() }}
        onInteractOutside={(event) => { if (busy) event.preventDefault() }}
      >
        <p className="mb-2 text-[.72rem] font-extrabold tracking-[.16em] text-brand-deep uppercase">{eyebrow}</p>
        <DialogTitle className="mb-3 font-serif text-3xl leading-tight font-medium tracking-tight">{title}</DialogTitle>
        <DialogDescription className="leading-relaxed text-muted">{description}</DialogDescription>
        {children && <div className="mt-4 grid gap-3 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-sm [&_label]:font-bold [&_textarea]:min-h-24 [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-bone-400 [&_textarea]:bg-surface [&_textarea]:p-3 [&_textarea]:text-base [&_textarea]:font-normal">{children}</div>}
        {error && <p className="mt-4 rounded-xl border border-[#e8b9ae] bg-[#fdf0ec] px-4 py-3 text-sm font-semibold text-[#7b2d20]" role="alert">{error}</p>}
        <div className="mt-6 flex justify-end gap-2.5 max-sm:flex-col-reverse [&>button]:max-sm:w-full">
          <Button ref={safeButton} variant="ghost" disabled={busy} onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="danger" disabled={busy || confirmDisabled} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
