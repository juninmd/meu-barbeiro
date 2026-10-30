import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

const badge = cva('inline-flex items-center rounded-full px-2.5 py-1 text-[.65rem] font-black tracking-[.07em] uppercase', {
  variants: {
    tone: {
      neutral: 'bg-surface-3 text-muted',
      success: 'bg-success-soft text-success-ink',
      warning: 'bg-[#f3d899] text-[#6d4d16]',
      danger: 'bg-danger-soft text-danger-ink',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export function Badge({ tone, className, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />
}
