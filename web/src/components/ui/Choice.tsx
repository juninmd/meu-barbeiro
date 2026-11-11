import { Check } from 'lucide-react'
import { cn } from '../../lib/cn'

interface ChoiceCardProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'title'> {
  icon?: React.ReactNode
  title: React.ReactNode
  hint?: React.ReactNode
  recommended?: boolean
}

/** Cartão de escolha (radio ou checkbox) com input real cobrindo o cartão: foco, teclado e leitores de tela nativos. */
export function ChoiceCard({ icon, title, hint, recommended, className, style, type = 'radio', ...input }: ChoiceCardProps) {
  const selected = Boolean(input.checked)
  return (
    <label style={style} className={cn(
      'group relative flex min-h-24 cursor-pointer flex-col justify-between gap-2.5 rounded-[1.15rem] border-[1.5px] bg-surface p-4 transition duration-300 ease-[cubic-bezier(.22,1,.36,1)] [&_svg]:size-5',
      'hover:-translate-y-0.5 hover:border-brand-deep/60 hover:shadow-md has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand/35',
      selected ? 'border-brand bg-tint shadow-[0_0_0_4px_color-mix(in_oklab,var(--amber)_18%,transparent)]' : recommended ? 'border-brand' : 'border-line',
      input.disabled && 'cursor-not-allowed opacity-60 hover:translate-y-0 hover:border-line hover:shadow-none',
      className,
    )}>
      <input className="absolute inset-0 size-full cursor-[inherit] opacity-0" type={type} {...input} />
      {icon && <span className="relative text-brand-deep" aria-hidden="true">{icon}</span>}
      <span className="relative grid gap-0.5">
        <strong className="text-[.9rem]">{title}</strong>
        {hint && <small className="text-xs text-muted">{hint}</small>}
      </span>
      {selected && <Check className="absolute top-3 right-3 !size-6 animate-pop rounded-full bg-brand p-1 text-on-brand" aria-hidden="true" />}
    </label>
  )
}

/** Grupo numerado de um passo de formulário ("01 Cliente"). */
export function StepFieldset({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid min-w-0 gap-4">
      <legend className="mb-4 flex w-full items-center gap-3 font-serif text-2xl font-medium"><span className="grid size-8 place-items-center rounded-xl bg-tint font-mono text-xs font-semibold tracking-normal text-tint-ink">{step}</span> {title}</legend>
      {children}
    </fieldset>
  )
}

export function Stepper({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label={label}>
      {steps.map((name, index) => {
        const state = current === index + 1 ? 'current' : current > index + 1 ? 'complete' : 'todo'
        return (
          <li className={cn('flex items-center gap-2 text-[.7rem] font-extrabold after:h-1 after:flex-1 after:rounded-full after:bg-line last:after:hidden sm:text-xs', state === 'todo' ? 'text-muted' : 'text-brand-deep')} aria-current={state === 'current' ? 'step' : undefined} key={name}>
            <span className={cn('grid size-7 shrink-0 place-items-center rounded-full border font-mono transition duration-300', state === 'todo' ? 'border-line' : 'border-brand bg-brand text-on-brand', state === 'current' && 'scale-110 shadow-glow')}>{state === 'complete' ? <Check className="size-4" aria-hidden="true" /> : index + 1}</span>
            <span>{name}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** Barra de ações do formulário; no celular fica fixa acima da navegação inferior. */
export function ActionBar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-wrap justify-end gap-3 border-t border-line pt-4 max-sm:fixed max-sm:inset-x-2.5 max-sm:bottom-[calc(86px+env(safe-area-inset-bottom))] max-sm:z-35 max-sm:flex-nowrap max-sm:rounded-[1.4rem] max-sm:border max-sm:bg-surface/85 max-sm:p-2 max-sm:shadow-lg max-sm:backdrop-blur-xl max-sm:backdrop-saturate-150 max-sm:[&>*]:flex-1', className)} {...props} />
}
