import { Star } from 'lucide-react'
import { cn } from '../../lib/cn'

/** Estrelas somente leitura. `value` aceita decimais (média). */
export function Stars({ value, className, label }: { value: number; className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-brand', className)} role="img" aria-label={label ?? `Nota ${value} de 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} aria-hidden="true" className={cn('size-4', value >= star - 0.25 ? 'fill-current' : value >= star - 0.75 ? 'fill-current opacity-50' : 'text-bone-400 opacity-60')} />
      ))}
    </span>
  )
}

/** Seleção de nota de 1 a 5 (grupo de rádio acessível, setas do teclado). */
export function StarInput({ value, onChange, name = 'Nota' }: { value: number; onChange: (value: number) => void; name?: string }) {
  const labels = ['Péssimo', 'Ruim', 'Bom', 'Muito bom', 'Excelente']
  return (
    <div role="radiogroup" aria-label={name} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star} type="button" role="radio" aria-checked={value === star} aria-label={`${star} ${star === 1 ? 'estrela' : 'estrelas'} — ${labels[star - 1]}`}
          tabIndex={value === star || (value === 0 && star === 1) ? 0 : -1}
          onClick={() => onChange(star)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); onChange(Math.min(5, (value || 0) + 1)) }
            if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); onChange(Math.max(1, (value || 2) - 1)) }
          }}
          className="grid size-11 place-items-center rounded-xl text-brand transition hover:bg-brand/15 focus-visible:outline-3 focus-visible:outline-brand"
        >
          <Star aria-hidden="true" className={cn('size-7 transition', value >= star ? 'fill-current' : 'text-bone-400')} />
        </button>
      ))}
      {value > 0 && <span className="ml-2 text-sm font-bold text-muted" aria-live="polite">{labels[value - 1]}</span>}
    </div>
  )
}
