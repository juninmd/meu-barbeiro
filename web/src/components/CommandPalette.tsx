import { CommandPalette as SonidoCommandPalette, Kbd, type Command } from '@juninmd/sonido'
import { Monitor, Moon, Search, Sun, UserRound, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/theme'

export interface PaletteLink {
  label: string
  path: string
  icon: React.ReactNode
}

/** Ação executável pela paleta (encaixe, fechar caixa, copiar link...). */
export interface PaletteAction {
  label: string
  hint: string
  icon: React.ReactNode
  run: () => void
}

/**
 * Paleta de comandos do Sonido: busca sem acento, grupos, setas e Enter.
 * O app mantém o gatilho próprio no cabeçalho e as ações do dia a dia.
 */
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

  const commands: Command[] = [
    ...links.map((link) => ({ id: `link-${link.path}`, label: link.label, group: 'Ir para', icon: link.icon, run: () => navigate(link.path) })),
    { id: 'account', label: 'Minha conta', group: 'Ir para', icon: <UserRound aria-hidden="true" />, run: () => navigate('/conta') },
    ...actions.map((action) => ({ id: `action-${action.label}`, label: action.label, group: 'Ações', icon: action.icon, hint: action.hint, run: action.run })),
    { id: 'theme-light', label: 'Tema claro', group: 'Aparência', icon: <Sun aria-hidden="true" />, run: () => setTheme('light') },
    { id: 'theme-dark', label: 'Tema escuro', group: 'Aparência', icon: <Moon aria-hidden="true" />, run: () => setTheme('dark') },
    { id: 'theme-system', label: 'Tema automático', group: 'Aparência', icon: <Monitor aria-hidden="true" />, run: () => setTheme('system') },
    { id: 'logout', label: 'Sair', group: 'Sessão', icon: <LogOut aria-hidden="true" />, run: onLogout },
  ]

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full border border-line bg-surface px-3.5 text-[.82rem] text-muted shadow-sm transition hover:-translate-y-px hover:border-brand hover:text-ink focus-visible:ring-4 focus-visible:ring-brand/40 focus-visible:outline-none min-[900px]:min-w-60 max-sm:size-11 max-sm:justify-center max-sm:px-0"
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="flex-1 text-left max-sm:sr-only">Buscar<span className="sr-only"> comandos</span>{actions.length > 0 && <span className="max-[899px]:hidden" aria-hidden="true"> ou executar.</span>}</span>
        <Kbd className="max-md:hidden" aria-hidden="true">Ctrl K</Kbd>
      </button>
      <SonidoCommandPalette
        open={open}
        onClose={() => setOpen(false)}
        commands={commands}
        label="Paleta de comandos"
        placeholder={actions.length > 0 ? 'Ir para ou executar. ex.: encaixe, caixa, convite' : 'Ir para.'}
        emptyText="Nada encontrado."
      />
    </>
  )
}
