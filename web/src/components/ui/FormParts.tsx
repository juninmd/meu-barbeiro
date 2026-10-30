import { cn } from '../../lib/cn'

/** Peças de formulário de configuração: grupo com legenda, dica e interruptor com alvo de toque de 44px. */
export function Group({ legend, children }: { legend: React.ReactNode; children: React.ReactNode }) {
  return (
    <fieldset className="grid min-w-0 content-start gap-3.5 rounded-xl border border-line p-4">
      <legend className="flex items-center gap-2 px-1.5 font-serif text-base font-medium">{legend}</legend>
      {children}
    </fieldset>
  )
}

export const Hint = ({ children }: { children: React.ReactNode }) => <p className="text-xs leading-relaxed text-muted">{children}</p>

export function Toggle({ checked, disabled, onChange, children }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 font-bold has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <input className="size-5 accent-brand" type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /> {children}
    </label>
  )
}


/** Formulário embutido em um card: painel suave com título, para criar itens de uma lista. */
export function InsetForm({ title, icon, className, children, ...props }: Omit<React.FormHTMLAttributes<HTMLFormElement>, 'title'> & { title?: string; icon?: React.ReactNode }) {
  return (
    <form className={cn('mt-5 grid gap-4 rounded-xl border border-line bg-surface-2 p-4 sm:p-5', className)} {...props}>
      {title && <h3 className="flex items-center gap-2 font-serif text-lg font-medium [&_svg]:size-[1.1rem] [&_svg]:text-brand-deep">{icon}{title}</h3>}
      {children}
    </form>
  )
}

export function FormRow({ columns = 2, children }: { columns?: 2 | 3; children: React.ReactNode }) {
  return <div className={cn('grid gap-3', columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>{children}</div>
}

/** Linha de lista com título + detalhe à esquerda e ação opcional à direita. */
export const listRowStyles = 'flex items-center justify-between gap-2 border-b border-line py-3.5 [&>div]:grid [&>div]:gap-0.5 [&_strong]:text-[.88rem] [&_span]:text-xs [&_span]:text-muted'
