import { Avatar as SonidoAvatar } from '@juninmd/sonido'
import { cn } from '../../lib/cn'

const sizes = { sm: 36, md: 44, lg: 64 } as const

/** `Avatar` do Sonido com as três medidas que o app já usava (36/44/64px). */
export function Avatar({ name, size = 'md', className }: { name: string; size?: keyof typeof sizes; className?: string }) {
  return <SonidoAvatar name={name} size={sizes[size]} ring className={cn('shrink-0', className)} />
}
