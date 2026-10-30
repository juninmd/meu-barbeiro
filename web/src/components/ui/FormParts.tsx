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

