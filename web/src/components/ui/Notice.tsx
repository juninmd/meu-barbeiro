import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

const notice = cva('rounded-r-xl border-l-[3px] px-4 py-3 text-sm leading-relaxed', {
  variants: {
    tone: {
      info: 'border-brand bg-tint text-tint-ink',
      danger: 'border-danger bg-danger-soft text-danger-ink',
      success: 'border-ok bg-success-soft text-success-ink',
    },
  },
  defaultVariants: { tone: 'info' },
})

/** Faixa de aviso com barra lateral. Use `role="alert"` para erros e `role="status"` para confirmações. */
export function Notice({ tone, className, ...props }: React.HTMLAttributes<HTMLParagraphElement> & VariantProps<typeof notice>) {
  return <p className={cn(notice({ tone }), className)} {...props} />
}

export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mb-1 flex items-center gap-2 text-[.72rem] font-extrabold tracking-[.18em] text-brand-deep uppercase', className)} {...props} />
}

export function SectionHeading({ eyebrow, title, id, aside, className }: { eyebrow: string; title: string; id: string; aside?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div><Eyebrow>{eyebrow}</Eyebrow><h2 id={id} className="font-serif text-2xl font-medium tracking-tight">{title}</h2></div>
      {aside}
    </div>
  )
}

/** Número em destaque com rótulo (métricas de fechamento, relatórios). */
export function StatTile({ icon, label, value, hint, featured }: { icon?: React.ReactNode; label: string; value: string; hint?: string; featured?: boolean }) {
  return (
    <article className={cn('grid gap-1.5 rounded-xl border p-4', featured ? 'border-chrome bg-chrome text-chrome-ink' : 'border-line bg-surface-2')}>
      <span className={cn('flex items-center gap-1.5 text-[.66rem] font-extrabold tracking-wide uppercase [&_svg]:size-4', featured ? 'text-chrome-ink/75' : 'text-muted')}>{icon}{label}</span>
      <strong className="font-serif text-2xl font-medium tabular-nums">{value}</strong>
      {hint && <small className={cn('text-xs', featured ? 'text-chrome-ink/70' : 'text-muted')}>{hint}</small>}
    </article>
  )
}
