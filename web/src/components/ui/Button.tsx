import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

export const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl border font-bold tracking-[.005em] transition duration-150 select-none enabled:active:scale-[.985] disabled:cursor-not-allowed disabled:opacity-55 [&_svg]:size-[1.1rem] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'border-[#c98a26] bg-linear-to-b from-brand-light to-brand text-[#1c1810] shadow-[0_6px_16px_-4px_#d99b3299,inset_0_1px_0_#ffffff55] enabled:hover:-translate-y-0.5 enabled:hover:from-[#f7d58b] enabled:hover:to-brand-light',
        dark: 'border-ink bg-ink text-paper shadow-sm enabled:hover:-translate-y-0.5',
        ghost: 'border-line bg-surface text-[#4f4b41] enabled:hover:border-brand enabled:hover:text-ink',
        danger: 'border-danger bg-danger text-white enabled:hover:-translate-y-0.5',
      },
      size: { sm: 'min-h-11 px-3 text-xs', md: 'min-h-12 px-5 text-sm', lg: 'min-h-14 px-6 text-base' },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonStyles> {
  loading?: boolean
}

export function Button({ className, variant, size, block, loading, disabled, children, type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonStyles({ variant, size, block }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}
