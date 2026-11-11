import { cn } from '../../lib/cn'

export const cardStyles = 'animate-[fade-in_.5s_cubic-bezier(.22,1,.36,1)_both] rounded-[1.4rem] border border-line bg-surface p-5 shadow-card sm:p-7'

type CardProps = React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'article' | 'form' | 'div'; onSubmit?: React.FormEventHandler<HTMLElement>; noValidate?: boolean }

export function Card({ as: Tag = 'div', className, ...props }: CardProps) {
  return <Tag className={cn(cardStyles, className)} {...props} />
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8 animate-fade-up">
      <p className="mb-3 flex items-center gap-2 font-mono text-[.68rem] font-semibold tracking-[.14em] text-muted uppercase before:h-0.5 before:w-4 before:rounded-full before:bg-pole">{eyebrow}</p>
      <h1 className="mb-2 font-serif text-[2.5rem] leading-[.95] font-medium tracking-tight sm:text-6xl">{title}</h1>
      {children && <p className="max-w-2xl text-muted">{children}</p>}
    </header>
  )
}
