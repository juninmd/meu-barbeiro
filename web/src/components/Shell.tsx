import {
  Building2,
  Ban,
  Link2,
  Plus,
  Receipt,
  RotateCcw,
  ShoppingBag,
  UserPlus,
  Wallet,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  CreditCard,
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
import { LayoutGroup, motion } from 'motion/react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { mockEnabled } from '../lib/repository'
import { Avatar } from './ui/Avatar'
import { CommandPalette, type PaletteAction } from './CommandPalette'
import { cn } from '../lib/cn'
import { brandStyle } from '../lib/brand'
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
  /** Grupo do menu lateral (Operação, Negócio, Configuração). */
  group?: string
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
  { label: 'Hoje', path: '/barbeiro/hoje', icon: <Clock3 />, group: 'Operação' },
  { label: 'Agenda', path: '/barbeiro/agenda', icon: <CalendarDays />, group: 'Operação' },
  { label: 'Clientes', path: '/barbeiro/clientes', icon: <UsersRound />, group: 'Operação' },
  { label: 'Produtos', path: '/barbeiro/produtos', icon: <Package />, group: 'Operação' },
  { label: 'Financeiro', path: '/barbeiro/financeiro', icon: <CircleDollarSign />, group: 'Negócio' },
  { label: 'Equipe', path: '/barbeiro/equipe', icon: <UsersRound />, group: 'Negócio' },
  { label: 'Assinatura', path: '/barbeiro/assinatura', icon: <CreditCard />, group: 'Negócio' },
  { label: 'Ajustes', path: '/barbeiro/ajustes', icon: <Settings />, group: 'Configuração' },
]

const managerOnlyPaths = new Set(['/barbeiro/financeiro', '/barbeiro/equipe', '/barbeiro/assinatura'])

export function Shell({ user, barbershop, children, onLogout }: ShellProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const [theme, setTheme] = useTheme()
  const moreMenu = useRef<HTMLDivElement>(null)
  const isAdmin = Boolean(user.platformAdmin)
  const isBarber = !isAdmin && (user.role === 'BARBER' || user.role === 'ADMIN')
  const canManage = barbershop?.membershipRole === 'OWNER' || barbershop?.membershipRole === 'ADMIN'
  const navigation = isAdmin
    ? adminNavigation
    : isBarber
      ? barberNavigation.filter((item) => canManage || !managerOnlyPaths.has(item.path))
      : clientNavigation
  const visibleMobile = isBarber ? navigation.slice(0, 4) : navigation
  const overflowMobile = isBarber ? navigation.slice(4) : []
  const home = isAdmin ? '/admin/visao' : isBarber ? '/barbeiro/hoje' : '/cliente/horarios'
  const roleLabel = isAdmin ? 'Administrador' : user.role === 'CUSTOMER' ? 'Cliente' : barbershop?.membershipRole === 'BARBER' ? 'Barbeiro' : 'Gestão'
  const current = navigation.find((item) => location.pathname === item.path)
  const groups = [...new Set(navigation.map((item) => item.group ?? (isAdmin ? 'Plataforma' : 'Sua conta')))]
  const overflowActive = overflowMobile.some((item) => item.path === location.pathname)

  useEffect(() => setMoreOpen(false), [location.pathname])

  // Atalhos da paleta levam a âncoras (#fechamento, #servicos…): rola até elas quando a tela renderizar.
  useEffect(() => {
    if (!location.hash) return
    const timer = window.setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
    return () => window.clearTimeout(timer)
  }, [location.hash, location.pathname])

  const copyBookingLink = async () => {
    const link = `${window.location.origin}/b/${barbershop?.slug ?? ''}`
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link de agendamento copiado.')
    } catch {
      toast.info(link)
    }
  }
  const actions: PaletteAction[] = isAdmin
    ? []
    : isBarber
      ? [
          { label: 'Novo encaixe', hint: 'Hoje', icon: <Plus />, run: () => navigate('/barbeiro/hoje?acao=encaixe') },
          { label: 'Bloquear horário ou ausência', hint: 'Agenda', icon: <Ban />, run: () => navigate('/barbeiro/agenda#disponibilidade') },
          { label: 'Registrar venda de produto', hint: 'Produtos', icon: <ShoppingBag />, run: () => navigate('/barbeiro/produtos') },
          ...(canManage ? [
            { label: 'Fechar o caixa de hoje', hint: 'Caixa', icon: <Receipt />, run: () => navigate('/barbeiro/financeiro#fechamento') },
            { label: 'Convidar barbeiro', hint: 'Equipe', icon: <UserPlus />, run: () => navigate('/barbeiro/equipe') },
            { label: 'Cadastrar serviço', hint: 'Ajustes', icon: <Plus />, run: () => navigate('/barbeiro/ajustes#servicos') },
            { label: 'Copiar link de agendamento', hint: 'Link', icon: <Link2 />, run: () => void copyBookingLink() },
          ] : []),
        ]
      : [
          { label: 'Agendar um horário', hint: 'Agendar', icon: <Scissors />, run: () => navigate('/cliente/agendar') },
          { label: 'Repetir último corte', hint: 'Agendar', icon: <RotateCcw />, run: () => navigate('/cliente/agendar?acao=repetir') },
          { label: 'Ver carteira e fidelidade', hint: 'Perfil', icon: <Wallet />, run: () => navigate('/cliente/perfil') },
        ]

  useEffect(() => {
    if (!moreOpen) return
    const close = (event: MouseEvent) => {
      if (!moreMenu.current?.contains(event.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [moreOpen])

  return (
    <div className="min-h-screen bg-paper" style={brandStyle(barbershop?.primaryColor)}>
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/75 px-[max(1.25rem,calc((100vw-1440px)/2+1.25rem))] pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150 max-sm:px-4">
        <div className="flex min-h-[68px] items-center justify-between gap-3 max-sm:min-h-[58px]">
          <NavLink className="group flex min-w-0 items-center gap-3 rounded-full text-ink no-underline focus-visible:ring-4 focus-visible:ring-brand/40 focus-visible:outline-none" to={home}>
            <span className="barber-pole h-8 w-3 shrink-0 rounded-full ring-1 ring-line" aria-hidden="true" />
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-ink text-paper shadow-sm transition duration-300 group-hover:-rotate-6">
              {barbershop?.logoUrl ? <img className="size-full object-cover" src={barbershop.logoUrl} alt="" /> : <Scissors className="size-[1.1rem]" aria-hidden="true" />}
            </span>
            <span className="grid min-w-0 leading-tight max-sm:sr-only">
              <strong className="truncate font-serif text-[1.05rem] font-medium">{isAdmin || !barbershop?.name ? 'Meu Barbeiro' : barbershop.name}<span className="sr-only"> - início</span></strong>
              <small className="font-mono text-[.62rem] tracking-[.14em] text-muted uppercase" aria-hidden="true">{isAdmin ? 'Plataforma' : isBarber ? 'Painel' : 'Sua barbearia'}</small>
            </span>
          </NavLink>
          <div className="flex min-w-0 items-center gap-2.5">
            <CommandPalette links={navigation} actions={actions} onLogout={onLogout} />
            <DropdownMenu>
              <DropdownMenuTrigger className="group flex cursor-pointer items-center gap-2.5 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-ink shadow-sm transition hover:-translate-y-px hover:border-brand focus-visible:ring-4 focus-visible:ring-brand/40 focus-visible:outline-none data-[state=open]:border-brand max-sm:pr-1.5">
                <Avatar name={user.name} size="sm" />
                <span className="grid min-w-0 text-left max-sm:hidden">
                  <strong className="truncate text-[.83rem]">{user.name}</strong>
                  <small className="truncate text-[.7rem] text-muted">{roleLabel}</small>
                </span>
                <span className="sr-only">, menu da conta</span>
                <ChevronDown className="size-4 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden="true" />
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
                <DropdownMenuLabel><small className="font-mono text-[.66rem] font-semibold tracking-wider text-muted uppercase">Aparência</small></DropdownMenuLabel>
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
        </div>
      </header>
      {mockEnabled && <div className="flex items-center justify-center gap-2 border-b border-line bg-tint px-4 py-1.5 text-center font-mono text-[.66rem] font-semibold tracking-[.08em] text-tint-ink uppercase max-sm:px-3 max-sm:text-[.6rem] max-sm:tracking-[.06em]"><span className="live-dot" aria-hidden="true" />Modo demonstração<span className="max-sm:hidden"> · dados salvos apenas neste navegador</span></div>}
      <span className="sr-only" aria-live="polite">Seção atual: {current?.label ?? 'Início'}</span>
      <div className="mx-auto grid w-[min(1480px,100%)] grid-cols-[232px_minmax(0,1fr)] max-[900px]:block">
        <LayoutGroup id="side-nav">
          <nav className="sticky top-[84px] grid h-fit gap-0.5 px-4 pt-10 pb-8 max-[900px]:hidden" aria-label="Navegação principal">
            {groups.map((group) => (
              <div className="mt-5 grid gap-0.5 first:mt-0" key={group}>
                <p className="mb-1.5 ml-3 font-mono text-[.62rem] font-semibold tracking-[.14em] text-muted uppercase">{group}</p>
                {navigation.filter((item) => (item.group ?? (isAdmin ? 'Plataforma' : 'Sua conta')) === group).map((item) => <SectionLink item={item} key={item.path} />)}
              </div>
            ))}
          </nav>
        </LayoutGroup>
        <div className="min-w-0 max-sm:px-[env(safe-area-inset-left)]">{children}</div>
      </div>
      <LayoutGroup id="tab-nav">
        <nav className="fixed inset-x-2.5 bottom-[max(.6rem,env(safe-area-inset-bottom))] z-40 hidden min-h-[66px] items-stretch justify-around rounded-[1.6rem] border border-line bg-surface/80 px-1 text-ink shadow-[0_18px_40px_-14px_#11131d55] backdrop-blur-xl backdrop-saturate-150 max-[900px]:flex" aria-label="Navegação principal">
          {visibleMobile.map((item) => <SectionLink item={item} variant="tab" key={item.path} />)}
          {overflowMobile.length > 0 && (
            <div className="relative flex flex-1" ref={moreMenu}>
              {moreOpen && (
                <div className="absolute right-0 bottom-[calc(100%+.6rem)] grid w-[200px] origin-bottom-right animate-in rounded-[1.25rem] border border-line bg-surface p-1.5 text-ink shadow-lg fade-in-0 zoom-in-95 slide-in-from-bottom-2">
                  {overflowMobile.map((item) => <SectionLink item={item} variant="menu" key={item.path} />)}
                </div>
              )}
              <button className={cn(linkBase, linkTab, 'w-full cursor-pointer', overflowActive && 'text-brand-deep')} type="button" aria-expanded={moreOpen} aria-haspopup="menu" onClick={() => setMoreOpen((open) => !open)}>
                <MoreHorizontal aria-hidden="true" /><span>Mais</span>
              </button>
            </div>
          )}
        </nav>
      </LayoutGroup>
    </div>
  )
}

const linkBase = 'relative isolate flex min-h-11 min-w-11 items-center gap-3 rounded-[14px] border-0 bg-transparent px-3 py-2.5 text-[.86rem] font-medium text-muted no-underline transition focus-visible:ring-4 focus-visible:ring-brand/40 focus-visible:outline-none [&_svg]:size-[1.15rem] [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-300'
const linkTab = 'min-h-[58px] flex-1 flex-col justify-center gap-0.5 rounded-[1.2rem] p-1 text-center text-[.62rem] font-semibold [&_svg]:size-5'

function SectionLink({ item, variant = 'side' }: { item: NavigationItem; variant?: 'side' | 'tab' | 'menu' }) {
  return (
    <NavLink
      to={item.path}
      aria-label={item.label}
      className={({ isActive }) => cn(
        linkBase,
        variant === 'side' && 'hover:text-ink hover:[&_svg]:-translate-y-px hover:[&_svg]:scale-110',
        variant === 'tab' && linkTab,
        variant === 'menu' && 'min-h-12 justify-start gap-2.5 text-[.8rem] text-ink hover:bg-surface-2',
        isActive && variant === 'side' && 'font-semibold text-brand-deep',
        isActive && variant === 'tab' && 'text-brand-deep [&_svg]:-translate-y-0.5',
        isActive && variant === 'menu' && 'bg-tint font-semibold text-tint-ink',
      )}
    >
      {({ isActive }) => (
        <>
          {isActive && variant !== 'menu' && (
            <motion.span
              layoutId="nav-active"
              className={cn('absolute inset-0 -z-10 rounded-[inherit]', variant === 'side' ? 'bg-tint' : 'bg-tint/80')}
              transition={{ type: 'spring', stiffness: 520, damping: 38 }}
              aria-hidden="true"
            />
          )}
          <span aria-hidden="true" className="contents">{item.icon}</span>
          <span className="relative">{item.label}</span>
          {isActive && variant === 'tab' && <span className="absolute bottom-1.5 size-1 rounded-full bg-brand" aria-hidden="true" />}
        </>
      )}
    </NavLink>
  )
}
