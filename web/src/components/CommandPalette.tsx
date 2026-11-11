import { Command } from 'cmdk'
import { Monitor, Moon, Search, Sun, UserRound, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/Dialog'
import { useTheme } from '../lib/theme'

export interface PaletteLink {
  label: string
  path: string
  icon: React.ReactNode
}

/** Ação executável pela paleta (encaixe, fechar caixa, copiar link…). */
export interface PaletteAction {
  label: string
  hint: string
  icon: React.ReactNode
  run: () => void
}

const item = 'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink transition-colors data-[selected=true]:bg-tint data-[selected=true]:text-tint-ink [&_svg]:size-4 [&_svg]:text-muted data-[selected=true]:[&_svg]:text-brand-deep'
const groupStyles = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[.64rem] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase'

/** Paleta de comandos: Ctrl/⌘ + K navega, executa ações do dia a dia, troca o tema e encerra a sessão. */
export function CommandPalette({ links, actions = [], onLogout }: { links: PaletteLink[]; actions?: PaletteAction[]; onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const [, setTheme] = useTheme()
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const run = (action: () => void) => () => { setOpen(false); action() }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full border border-line bg-surface px-3.5 text-[.82rem] text-muted shadow-sm transition hover:-translate-y-px hover:border-brand hover:text-ink focus-visible:ring-4 focus-visible:ring-brand/40 focus-visible:outline-none min-[900px]:min-w-60 max-sm:size-11 max-sm:justify-center max-sm:px-0"
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="flex-1 text-left max-sm:sr-only">Buscar<span className="sr-only"> comandos</span>{actions.length > 0 && <span className="max-[899px]:hidden" aria-hidden="true"> ou executar…</span>}</span>
        <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[.65rem] text-ink max-md:hidden" aria-hidden="true">Ctrl K</kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-3 sm:p-3">
          <DialogTitle className="sr-only">Paleta de comandos</DialogTitle>
          <DialogDescription className="sr-only">Digite para buscar uma página ou ação e confirme com Enter.</DialogDescription>
          <Command label="Paleta de comandos" loop>
            <div className="flex items-center gap-3 border-b border-line px-3 pb-3">
              <Search className="size-5 text-muted" aria-hidden="true" />
              <Command.Input autoFocus placeholder={actions.length > 0 ? 'Ir para ou executar… ex.: encaixe, caixa, convite' : 'Ir para…'} className="min-h-11 w-full border-0 bg-transparent px-0 text-base text-ink shadow-none outline-none placeholder:text-muted/70 focus-visible:border-0 focus-visible:shadow-none" />
            </div>
            <Command.List className="max-h-[min(24rem,60vh)] overflow-y-auto pt-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-muted">Nada encontrado.</Command.Empty>
              <Command.Group heading="Ir para" className={groupStyles}>
                {links.map((link) => (
                  <Command.Item key={link.path} value={link.label} className={item} onSelect={run(() => navigate(link.path))}>{link.icon}{link.label}</Command.Item>
                ))}
                <Command.Item value="Minha conta" className={item} onSelect={run(() => navigate('/conta'))}><UserRound aria-hidden="true" />Minha conta</Command.Item>
              </Command.Group>
              {actions.length > 0 && (
                <Command.Group heading="Ações" className={groupStyles}>
                  {actions.map((action) => (
                    <Command.Item key={action.label} value={action.label} className={item} onSelect={run(action.run)}>
                      {action.icon}<span className="flex-1">{action.label}</span><small className="font-mono text-[.64rem] text-muted">{action.hint}</small>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading="Aparência" className={groupStyles}>
                <Command.Item value="Tema claro" className={item} onSelect={run(() => setTheme('light'))}><Sun aria-hidden="true" />Tema claro</Command.Item>
                <Command.Item value="Tema escuro" className={item} onSelect={run(() => setTheme('dark'))}><Moon aria-hidden="true" />Tema escuro</Command.Item>
                <Command.Item value="Tema automático" className={item} onSelect={run(() => setTheme('system'))}><Monitor aria-hidden="true" />Tema automático</Command.Item>
              </Command.Group>
              <Command.Group heading="Sessão" className={groupStyles}>
                <Command.Item value="Sair" className={item} onSelect={run(onLogout)}><LogOut aria-hidden="true" />Sair</Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
