import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Inbox,
  LayoutDashboard,
  ChevronDown,
  Monitor,
  Moon,
  Palette,
  Sun,
  LogOut,
  MoreHorizontal,
  Package,
  Scissors,
  Settings,
  Store,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { mockEnabled } from '../lib/repository'
import { Avatar } from './ui/Avatar'
import { CommandPalette } from './CommandPalette'
import { cn } from '../lib/cn'
import { useTheme, type ThemePreference } from '../lib/theme'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/DropdownMenu'
import type { Barbershop, User } from '../types'

interface ShellProps {
  user: User
  barbershop: Barbershop | null
  children: React.ReactNode
  onLogout: () => void
}

interface NavigationItem {
  label: string
  path: string
  icon: React.ReactNode
}

const clientNavigation: NavigationItem[] = [
  { label: 'Agendar', path: '/cliente/agendar', icon: <Scissors /> },
  { label: 'Meus horários', path: '/cliente/horarios', icon: <CalendarDays /> },
  { label: 'Perfil', path: '/cliente/perfil', icon: <UserRound /> },
  { label: 'Meu negócio', path: '/cliente/negocio', icon: <Store /> },
]

const adminNavigation: NavigationItem[] = [
  { label: 'Visão geral', path: '/admin/visao', icon: <LayoutDashboard /> },
  { label: 'Liberações', path: '/admin/solicitacoes', icon: <Inbox /> },
  { label: 'Estabelecimentos', path: '/admin/estabelecimentos', icon: <Building2 /> },
]

const barberNavigation: NavigationItem[] = [
  { label: 'Hoje', path: '/barbeiro/hoje', icon: <Clock3 /> },
  { label: 'Agenda', path: '/barbeiro/agenda', icon: <CalendarDays /> },
  { label: 'Clientes', path: '/barbeiro/clientes', icon: <UsersRound /> },
  { label: 'Produtos', path: '/barbeiro/produtos', icon: <Package /> },
  { label: 'Financeiro', path: '/barbeiro/financeiro', icon: <CircleDollarSign /> },
  { label: 'Ajustes', path: '/barbeiro/ajustes', icon: <Settings /> },
]

export function Shell({ user, barbershop, children, onLogout }: ShellProps) {
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const [theme, setTheme] = useTheme()
  const moreMenu = useRef<HTMLDivElement>(null)
  const isAdmin = Boolean(user.platformAdmin)
  const isBarber = !isAdmin && (user.role === 'BARBER' || user.role === 'ADMIN')
  const canManage = barbershop?.membershipRole === 'OWNER' || barbershop?.membershipRole === 'ADMIN'
  const navigation = isAdmin
    ? adminNavigation
    : isBarber
      ? barberNavigation.filter((item) => canManage || item.label !== 'Financeiro')
      : clientNavigation
  const visibleMobile = isBarber ? navigation.slice(0, 4) : navigation
  const overflowMobile = isBarber ? navigation.slice(4) : []
  const home = isAdmin ? '/admin/visao' : isBarber ? '/barbeiro/hoje' : '/cliente/horarios'
  const roleLabel = isAdmin ? 'Administrador' : user.role === 'CUSTOMER' ? 'Cliente' : barbershop?.membershipRole === 'BARBER' ? 'Barbeiro' : 'Gestão'
  const current = navigation.find((item) => location.pathname === item.path)

  useEffect(() => setMoreOpen(false), [location.pathname])

  useEffect(() => {
    if (!moreOpen) return
    const close = (event: MouseEvent) => {
      if (!moreMenu.current?.contains(event.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [moreOpen])

  return (
    <div className="min-h-screen bg-paper" style={{ '--amber': barbershop?.primaryColor || '#d99b32' } as React.CSSProperties}>
      <header className="sticky top-0 z-10 flex min-h-[76px] items-center justify-between gap-2 border-b border-brand/20 bg-linear-to-b from-[#1d1b14f2] to-[#15140ff2] px-[max(1.25rem,calc((100vw-1220px)/2))] text-chrome-ink shadow-[0_8px_24px_-16px_#000] backdrop-blur-xl backdrop-saturate-150 max-sm:min-h-[60px] max-sm:gap-2 max-sm:px-4 max-sm:pt-[max(.5rem,env(safe-area-inset-top))]">
        <NavLink className="flex items-center gap-3 rounded-full tracking-[.08em] text-inherit no-underline focus-visible:ring-4 focus-visible:ring-brand/40 focus-visible:outline-none [&_strong]:text-brand-light" to={home} aria-label={`${isAdmin || !barbershop?.name ? 'MEU BARBEIRO' : barbershop.name} - início`}>
          <span className="grid size-[38px] shrink-0 place-items-center rounded-full border border-white/15 bg-white/5">
            {barbershop?.logoUrl ? <img className="size-full rounded-full object-cover" src={barbershop.logoUrl} alt="" /> : <Scissors className="size-[1.1rem]" aria-hidden="true" />}
          </span>
          <span className="max-sm:hidden">{isAdmin || !barbershop?.name ? <><strong>MEU</strong> BARBEIRO</> : barbershop.name}</span>
        </NavLink>
        <div className="flex min-w-0 items-center gap-3.5 max-sm:gap-2">
          <CommandPalette links={navigation} onLogout={onLogout} />
          <DropdownMenu>
            <DropdownMenuTrigger className="group flex cursor-pointer items-center gap-2.5 rounded-full border border-white/12 bg-white/5 py-1 pr-3 pl-1 text-inherit transition hover:border-brand hover:bg-white/10 focus-visible:ring-4 focus-visible:ring-brand/40 focus-visible:outline-none data-[state=open]:border-brand data-[state=open]:bg-white/10 max-sm:pr-1.5">
              <Avatar name={user.name} size="sm" />
              <span className="grid min-w-0 text-left max-sm:hidden">
                <strong className="truncate text-[.83rem]">{user.name}</strong>
                <small className="truncate text-[.7rem] text-chrome-ink/60">{roleLabel}</small>
              </span>
              <span className="sr-only">, menu da conta</span>
              <ChevronDown className="size-4 text-chrome-ink/70 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <strong className="block text-sm">{user.name}</strong>
                <small className="text-xs text-muted">{user.email || user.username || roleLabel}</small>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <NavLink to="/conta"><UserRound aria-hidden="true" /> Minha conta</NavLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel><small className="text-[.68rem] font-extrabold tracking-wider text-muted uppercase">Aparência</small></DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemePreference)}>
                <DropdownMenuRadioItem value="light"><Sun aria-hidden="true" /> Claro</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark"><Moon aria-hidden="true" /> Escuro</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system"><Monitor aria-hidden="true" /> Automático</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              {(mockEnabled || isAdmin) && (
                <DropdownMenuItem asChild>
                  <NavLink to="/design-system"><Palette aria-hidden="true" /> Design system</NavLink>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={onLogout}>
                <LogOut aria-hidden="true" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {mockEnabled && <div className="bg-linear-to-r from-[#f6dca0] to-[#f1cb7d] px-4 py-1.5 text-center text-[.68rem] font-extrabold tracking-[.08em] text-[#5f4517] uppercase max-sm:px-3 max-sm:text-[.6rem] max-sm:tracking-[.06em]">Modo demonstração<span className="max-sm:hidden"> · dados salvos apenas neste navegador</span></div>}
      <span className="sr-only" aria-live="polite">Seção atual: {current?.label ?? 'Início'}</span>
      <div className="mx-auto grid w-[min(1480px,100%)] grid-cols-[210px_minmax(0,1fr)] max-[900px]:block">
        <nav className="sticky top-24 grid h-fit gap-1.5 px-4 pt-12 pb-8 max-[900px]:hidden" aria-label="Navegação principal">
          <p className="mb-3 ml-3 text-[.68rem] font-black tracking-[.14em] text-muted uppercase">{isAdmin ? 'Plataforma' : isBarber ? 'Painel' : 'Sua conta'}</p>
          {navigation.map((item) => <SectionLink item={item} key={item.path} />)}
        </nav>
        <div className="min-w-0 max-sm:px-[env(safe-area-inset-left)]">{children}</div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 hidden min-h-[72px] justify-around rounded-t-[18px] border-t border-white/10 bg-chrome px-[max(.35rem,env(safe-area-inset-right))] pt-1 pb-[max(.3rem,env(safe-area-inset-bottom))] text-chrome-ink shadow-[0_-10px_30px_-10px_#00000066] max-[900px]:flex" aria-label="Navegação principal">
        {visibleMobile.map((item) => <SectionLink item={item} variant="tab" key={item.path} />)}
        {overflowMobile.length > 0 && (
          <div className="relative flex flex-1" ref={moreMenu}>
            {moreOpen && (
              <div className="absolute right-0 bottom-[calc(100%+.45rem)] grid w-[190px] rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-lg">
                {overflowMobile.map((item) => <SectionLink item={item} variant="menu" key={item.path} />)}
              </div>
            )}
            <button className={cn(linkBase, linkTab, 'w-full cursor-pointer')} type="button" aria-expanded={moreOpen} aria-haspopup="menu" onClick={() => setMoreOpen((open) => !open)}>
              <MoreHorizontal aria-hidden="true" /><span>Mais</span>
            </button>
          </div>
        )}
      </nav>
    </div>
  )
}

const linkBase = 'flex min-h-11 min-w-11 items-center gap-3 rounded-[14px] border-0 bg-transparent p-3 text-[.82rem] font-semibold text-muted no-underline transition focus-visible:ring-4 focus-visible:ring-brand/40 focus-visible:outline-none [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:transition-transform'
const linkTab = 'min-h-[60px] flex-1 flex-col justify-center gap-0.5 rounded-none p-1 text-center text-[.62rem] text-[#bbb5a8] [&_svg]:size-5'

function SectionLink({ item, variant = 'side' }: { item: NavigationItem; variant?: 'side' | 'tab' | 'menu' }) {
  return (
    <NavLink
      to={item.path}
      aria-label={item.label}
      className={({ isActive }) => cn(
        linkBase,
        variant === 'side' && 'hover:bg-paper-deep hover:text-ink hover:[&_svg]:-translate-y-px hover:[&_svg]:scale-105',
        variant === 'tab' && linkTab,
        variant === 'menu' && 'min-h-12 justify-start gap-2.5 text-[.78rem] text-ink hover:bg-paper-deep',
        isActive && variant === 'side' && 'bg-surface font-bold text-ink shadow-[var(--shadow-sm),inset_3px_0_0_var(--amber)] [&_svg]:text-brand-deep',
        isActive && variant === 'tab' && 'bg-white/5 text-brand-light shadow-[inset_0_3px_0_var(--amber)]',
        isActive && variant === 'menu' && 'bg-paper-deep font-bold shadow-[inset_3px_0_0_var(--amber)]',
      )}
    >
      <span aria-hidden="true" className="contents">{item.icon}</span>{item.label}
    </NavLink>
  )
}
