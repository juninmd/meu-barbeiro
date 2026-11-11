import { cn } from '../../lib/cn'
import { Eyebrow } from './Notice'

/** Área principal de uma página: largura máxima, respiro e espaço para a navegação inferior no celular. */
export function PageWrap({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <main className={cn('mx-auto grid min-h-[calc(100vh-180px)] w-[min(100%-1.25rem,1220px)] content-start gap-5 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))] scroll-mt-24 sm:min-h-[calc(100vh-104px)] sm:w-[min(1220px,calc(100%-2.5rem))] sm:pt-12 min-[901px]:pb-20', className)} {...props} />
}

interface PageHeadingProps {
  eyebrow: React.ReactNode
  title: string
  children?: React.ReactNode
  /** Elemento à direita (ex.: data de hoje). */
  aside?: React.ReactNode
}

export function PageHeading({ eyebrow, title, children, aside }: PageHeadingProps) {
  return (
    <header className="flex animate-fade-up items-end justify-between gap-4 pb-1 sm:mb-2 sm:pb-4">
      <div className="flex flex-col justify-center">
        <Eyebrow className="mb-2.5">{eyebrow}</Eyebrow>
        <h1 className="mb-2 font-serif text-[2.3rem] leading-[.95] font-medium tracking-tight sm:text-[clamp(2.4rem,5vw,4.2rem)]">{title}</h1>
        {children && <p className="max-w-[680px] text-[.78rem] leading-snug text-muted sm:text-base">{children}</p>}
      </div>
      {aside}
    </header>
  )
}
