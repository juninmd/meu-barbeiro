import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

const badge = cva('inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[.64rem] font-semibold tracking-[.06em] uppercase', {
  variants: {
    tone: {
      neutral: 'bg-surface-3 text-muted',
      success: 'bg-success-soft text-success-ink',
      warning: 'bg-warn-soft text-warn',
      danger: 'bg-danger-soft text-danger-ink',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export function Badge({ tone, dot, className, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge> & { dot?: boolean }) {
  return <span className={cn('badge', badge({ tone }), dot && 'gap-1.5 before:size-1.5 before:rounded-full before:bg-current before:opacity-75', className)} {...props} />
}
