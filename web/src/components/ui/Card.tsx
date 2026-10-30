import { cn } from '../../lib/cn'

type CardProps = React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'article' | 'form' | 'div'; onSubmit?: React.FormEventHandler<HTMLElement> }

export function Card({ as: Tag = 'div', className, ...props }: CardProps) {
  return <Tag className={cn('rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-8', className)} {...props} />
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8 border-b border-line pb-6">
      <p className="mb-2 text-[.72rem] font-extrabold tracking-[.16em] text-brand-deep uppercase">{eyebrow}</p>
      <h1 className="mb-2 font-serif text-4xl leading-none font-medium tracking-tight sm:text-5xl">{title}</h1>
      {children && <p className="max-w-2xl text-muted">{children}</p>}
    </header>
  )
}
