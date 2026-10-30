import { cloneElement, isValidElement, useId } from 'react'
import { cn } from '../../lib/cn'

const control = 'w-full rounded-xl border border-control bg-surface px-3.5 py-2.5 text-base text-ink transition placeholder:text-muted/70 hover:border-muted focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/20 focus-visible:outline-none disabled:opacity-60'

export const inputStyles = (extra?: string) => cn(control, 'min-h-12', extra)

interface FieldProps {
  label: string
  hint?: React.ReactNode
  error?: string | null
  className?: string
  /** Um único controle (Input, textarea, select): recebe id e aria-describedby. */
  children: React.ReactElement<{ id?: string; 'aria-describedby'?: string }>
}

export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={id} className="text-[.8rem] font-bold text-ink/80">{label}</label>
      {isValidElement(children) ? cloneElement(children, { id, 'aria-describedby': describedBy }) : children}
      {hint && <small id={`${id}-hint`} className="text-xs text-muted">{hint}</small>}
      {error && <small id={`${id}-error`} role="alert" className="text-xs font-semibold text-danger">{error}</small>}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  trailing?: React.ReactNode
}

export function Input({ icon, trailing, className, ...props }: InputProps) {
  if (!icon && !trailing) return <input className={inputStyles(className)} {...props} />
  return (
    <div className="relative flex items-center">
      {icon && <span className="pointer-events-none absolute left-3.5 text-muted [&_svg]:size-[1.1rem]" aria-hidden="true">{icon}</span>}
      <input className={inputStyles(cn(icon && 'pl-11', trailing && 'pr-12', className))} {...props} />
      {trailing && <span className="absolute right-1 flex">{trailing}</span>}
    </div>
  )
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'min-h-24 resize-y leading-relaxed', className)} {...props} />
}
