import { Badge as SonidoBadge, type BadgeProps } from '@juninmd/sonido'
import { cn } from '../../lib/cn'

/**
 * `Badge` do Sonido: mesma API de tom do app, mais `appearance`, `dot` e `live`.
 * O app usa `soft` por padrão; contagens densas usam `appearance="count"`.
 */
export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return <SonidoBadge tone={tone} className={cn('badge', className)} {...props} />
}
