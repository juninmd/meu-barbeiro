import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

const avatar = cva('inline-grid shrink-0 place-items-center rounded-full bg-linear-to-br from-brand-light to-brand font-extrabold text-[#1c1810]', {
  variants: { size: { sm: 'size-9 text-sm', md: 'size-11 text-base', lg: 'size-16 text-2xl' } },
  defaultVariants: { size: 'md' },
})

export function Avatar({ name, size, className }: { name: string; className?: string } & VariantProps<typeof avatar>) {
  return <span className={cn(avatar({ size }), className)} aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
}
