import { cn } from '../../lib/cn'
import { Eyebrow } from './Notice'

/** Área principal de uma página: largura máxima, respiro e espaço para a navegação inferior no celular. */
export function PageWrap({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <main className={cn('mx-auto grid min-h-[calc(100vh-180px)] w-[min(100%-1.25rem,1220px)] content-start gap-5 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom))] scroll-mt-24 sm:min-h-[calc(100vh-104px)] sm:w-[min(1220px,calc(100%-2.5rem))] sm:pt-12 min-[901px]:pb-20', className)} {...props} />
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
    <header className="flex items-center justify-between gap-4 border-b border-line pb-3 sm:mb-3 sm:pb-6">
      <div className="flex flex-col justify-center">
        <Eyebrow className="mb-2.5">{eyebrow}</Eyebrow>
        <h1 className="mb-2 font-serif text-[2.1rem] leading-none font-medium tracking-tight sm:text-[clamp(2.1rem,4.2vw,3.6rem)]">{title}</h1>
        {children && <p className="max-w-[680px] text-[.78rem] leading-snug text-muted sm:text-base">{children}</p>}
      </div>
      {aside}
    </header>
  )
}
