import { cn } from '../../lib/cn'

/** Barra de saldo de sessões de um pacote. */
export function PackageMeter({ used, total, className }: { used: number; total: number; className?: string }) {
  const remaining = Math.max(0, total - used)
  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="flex items-baseline justify-between text-sm">
        <strong className="tabular-nums">{remaining} de {total} sessões restantes</strong>
      </div>
      <div className="flex gap-1" role="img" aria-label={`${remaining} de ${total} sessões restantes`}>
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className={cn('h-2 flex-1 rounded-full', index < used ? 'bg-paper-deep' : 'bg-brand')} />
        ))}
      </div>
    </div>
  )
}
