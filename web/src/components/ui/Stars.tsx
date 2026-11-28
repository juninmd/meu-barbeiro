import { Rating } from '@juninmd/sonido'
import { cn } from '../../lib/cn'

/** Estrelas somente leitura. `value` aceita decimais (média). */
export function Stars({ value, className, label }: { value: number; className?: string; label?: string }) {
  return <Rating value={value} label={label ?? 'Avaliação'} size={16} className={cn('sn-stars', className)} />
}

/** Seleção de nota de 1 a 5 (radiogroup do Sonido: setas do teclado, foco itinerante). */
export function StarInput({ value, onChange, name = 'Nota' }: { value: number; onChange: (value: number) => void; name?: string }) {
  return <Rating value={value} onChange={onChange} label={name} size={28} />
}
