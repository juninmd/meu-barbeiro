import { cn } from '../../lib/cn'

/** Caixa tracejada para listas vazias e erros recuperáveis: ícone, título (strong), texto (p) e ações como filhos. */
export const emptyStateStyles = 'grid justify-items-center gap-2 rounded-2xl border border-dashed border-line bg-surface-2 px-4 py-10 text-center text-sm text-muted [&_p]:max-w-prose [&_p]:text-xs [&_strong]:text-ink [&_svg]:size-8 [&_svg]:text-brand-deep/80 [&>button]:mt-1 [&>a]:mt-1'

export function EmptyState({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(emptyStateStyles, className)} {...props} />
}

/** Contador arredondado ao lado de títulos de seção. */
export function CountBadge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('grid min-w-8 shrink-0 place-items-center rounded-full border border-brand/30 bg-tint px-2.5 py-1 text-[.72rem] font-extrabold text-tint-ink tabular-nums', className)} {...props} />
}
