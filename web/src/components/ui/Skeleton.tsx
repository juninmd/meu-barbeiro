import { cn } from '../../lib/cn'

/** Placeholder de carregamento com brilho suave; respeita "reduzir movimento". */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('rounded-xl bg-linear-to-r from-paper-deep via-surface to-paper-deep bg-[length:200%_100%] motion-safe:animate-[shimmer_1.6s_ease-in-out_infinite]', className)} {...props} />
}
