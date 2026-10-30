import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

const focus = 'focus-visible:ring-4 focus-visible:ring-brand/35 focus-visible:outline-none disabled:cursor-wait disabled:opacity-55'

const iconButton = cva(`grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border border-line transition [&_svg]:size-[1.1rem] ${focus}`, {
  variants: {
    tone: {
      subtle: 'text-muted hover:border-danger hover:text-danger',
      neutral: 'text-muted hover:border-brand hover:bg-paper-deep hover:text-ink',
      danger: 'text-danger hover:border-danger hover:bg-danger-soft focus-visible:ring-danger/25',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

/** Botão redondo só com ícone (44px). Sempre passe `aria-label`. */
export function IconButton({ tone, className, type = 'button', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof iconButton>) {
  return <button type={type} className={cn(iconButton({ tone }), className)} {...props} />
}

const textButton = cva(`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-1 py-2.5 text-xs font-bold transition hover:underline [&_svg]:size-3.5 ${focus}`, {
  variants: { tone: { default: 'text-ink', danger: 'text-danger' } },
  defaultVariants: { tone: 'default' },
})

/** Ação textual discreta ao lado de itens de lista (editar, entrada, remover…). */
export function TextButton({ tone, className, type = 'button', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof textButton>) {
  return <button type={type} className={cn(textButton({ tone }), className)} {...props} />
}
