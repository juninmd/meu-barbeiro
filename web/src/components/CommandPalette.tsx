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

const item = 'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink data-[selected=true]:bg-paper-deep [&_svg]:size-4 [&_svg]:text-muted data-[selected=true]:[&_svg]:text-brand-deep'

/** Paleta de comandos: Ctrl/⌘ + K abre navegação, tema e conta em um só lugar. */
export function CommandPalette({ links, onLogout }: { links: PaletteLink[]; onLogout: () => void }) {
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
        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3.5 text-[.8rem] text-chrome-ink/75 transition hover:border-brand hover:bg-white/10 focus-visible:ring-4 focus-visible:ring-brand/40 focus-visible:outline-none max-sm:size-11 max-sm:justify-center max-sm:px-0"
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="max-sm:sr-only">Buscar</span><span className="sr-only"> comandos</span>
        <kbd className="rounded-md border border-white/15 px-1.5 py-0.5 font-sans text-[.65rem] max-md:hidden" aria-hidden="true">Ctrl K</kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-3 sm:p-3">
          <DialogTitle className="sr-only">Paleta de comandos</DialogTitle>
          <DialogDescription className="sr-only">Digite para buscar uma página ou ação e confirme com Enter.</DialogDescription>
          <Command label="Paleta de comandos" loop>
            <div className="flex items-center gap-3 border-b border-line px-3 pb-3">
              <Search className="size-5 text-muted" aria-hidden="true" />
              <Command.Input autoFocus placeholder="Ir para…" className="min-h-11 w-full border-0 bg-transparent px-0 text-base text-ink shadow-none outline-none placeholder:text-muted/70 focus-visible:border-0 focus-visible:shadow-none" />
            </div>
            <Command.List className="max-h-[min(24rem,60vh)] overflow-y-auto pt-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-muted">Nada encontrado.</Command.Empty>
              <Command.Group heading="Ir para" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[.68rem] [&_[cmdk-group-heading]]:font-extrabold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase">
                {links.map((link) => (
                  <Command.Item key={link.path} value={link.label} className={item} onSelect={run(() => navigate(link.path))}>{link.icon}{link.label}</Command.Item>
                ))}
                <Command.Item value="Minha conta" className={item} onSelect={run(() => navigate('/conta'))}><UserRound aria-hidden="true" />Minha conta</Command.Item>
              </Command.Group>
              <Command.Group heading="Aparência" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[.68rem] [&_[cmdk-group-heading]]:font-extrabold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase">
                <Command.Item value="Tema claro" className={item} onSelect={run(() => setTheme('light'))}><Sun aria-hidden="true" />Tema claro</Command.Item>
                <Command.Item value="Tema escuro" className={item} onSelect={run(() => setTheme('dark'))}><Moon aria-hidden="true" />Tema escuro</Command.Item>
                <Command.Item value="Tema automático" className={item} onSelect={run(() => setTheme('system'))}><Monitor aria-hidden="true" />Tema automático</Command.Item>
              </Command.Group>
              <Command.Group heading="Sessão" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[.68rem] [&_[cmdk-group-heading]]:font-extrabold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase">
                <Command.Item value="Sair" className={item} onSelect={run(onLogout)}><LogOut aria-hidden="true" />Sair</Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
