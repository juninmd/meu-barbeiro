import { Alert, StatTile as SonidoStatTile } from '@juninmd/sonido'
import { cn } from '../../lib/cn'

type NoticeTone = 'info' | 'danger' | 'success' | 'warning'

interface NoticeProps {
  tone?: NoticeTone
  className?: string
  children?: React.ReactNode
  /** Mantido por compatibilidade: o Sonido decide o role pelo tom (danger = alert). */
  role?: 'alert' | 'status'
}

/**
 * Faixa de aviso do Sonido. `danger` é anunciada como `alert`; os demais tons,
 * como `status`, sem precisar repetir o atributo em cada tela.
 */
export function Notice({ tone = 'info', className, children }: NoticeProps) {
  return <Alert tone={tone} className={cn('animate-fade-up', className)}>{children}</Alert>
}

export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mb-1 flex items-center gap-2 font-mono text-[.68rem] font-semibold tracking-[.14em] text-muted uppercase before:h-0.5 before:w-4 before:shrink-0 before:rounded-full before:bg-pole [&_svg]:size-3.5 [&_svg]:text-brand-deep', className)} {...props} />
}

export function SectionHeading({ eyebrow, title, id, aside, className }: { eyebrow: string; title: string; id: string; aside?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div><Eyebrow>{eyebrow}</Eyebrow><h2 id={id} className="font-serif text-2xl leading-tight font-medium tracking-tight">{title}</h2></div>
      {aside}
    </div>
  )
}

/** Número em destaque com rótulo (métricas de fechamento, relatórios). */
export function StatTile({ featured, icon, label, value, hint }: { icon?: React.ReactNode; label: string; value: string; hint?: string; featured?: boolean }) {
  return <SonidoStatTile label={label} value={value} hint={hint} icon={icon} tone={featured ? 'accent' : 'neutral'} />
}
