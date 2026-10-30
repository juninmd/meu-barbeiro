import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

const badge = cva('inline-flex items-center rounded-full px-2.5 py-1 text-[.65rem] font-black tracking-[.07em] uppercase', {
  variants: {
    tone: {
      neutral: 'bg-[#dfddd7] text-[#4f4c46]',
      success: 'bg-[#d4e7dc] text-[#2d5c47]',
      warning: 'bg-[#f3d899] text-[#6d4d16]',
      danger: 'bg-[#edd6d1] text-[#7b382e]',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export function Badge({ tone, className, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />
}
