import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

export const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-[14px] border font-semibold tracking-[.005em] transition duration-200 ease-[cubic-bezier(.22,1,.36,1)] select-none enabled:active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-55 [&_svg]:size-[1.1rem] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'border-transparent bg-brand text-on-brand shadow-glow enabled:hover:-translate-y-0.5 enabled:hover:brightness-110',
        dark: 'border-ink bg-ink text-paper shadow-sm enabled:hover:-translate-y-0.5',
        ghost: 'border-line bg-surface text-ink/85 enabled:hover:-translate-y-0.5 enabled:hover:border-brand enabled:hover:text-ink enabled:hover:shadow-card',
        danger: 'border-danger-solid bg-danger-solid text-white enabled:hover:-translate-y-0.5',
      },
      size: { sm: 'min-h-11 px-3 text-xs', md: 'min-h-12 px-5 text-sm', lg: 'min-h-14 px-6 text-base' },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

interface ButtonProps extends React.ComponentProps<'button'>, VariantProps<typeof buttonStyles> {
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
