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
    <div className="app-shell" style={{ '--amber': barbershop?.primaryColor || '#d99b32' } as React.CSSProperties}>
      <header className="topbar">
        <NavLink className="brand" to={home} aria-label={`${isAdmin || !barbershop?.name ? 'MEU BARBEIRO' : barbershop.name} - início`}>
          <span className="brand-icon">
            {barbershop?.logoUrl ? <img src={barbershop.logoUrl} alt="" /> : <Scissors aria-hidden="true" />}
          </span>
          <span>{isAdmin || !barbershop?.name ? <><strong>MEU</strong> BARBEIRO</> : barbershop.name}</span>
        </NavLink>
        <div className="profile-actions">
          <DropdownMenu>
            <DropdownMenuTrigger className="profile-link">
              <Avatar name={user.name} size="sm" />
              <span className="profile-copy">
                <strong>{user.name}</strong>
                <small>{roleLabel}</small>
              </span>
              <span className="sr-only">, menu da conta</span>
              <ChevronDown className="profile-chevron" aria-hidden="true" />
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
      {mockEnabled && <div className="dev-ribbon">Modo demonstração<span className="ribbon-extra"> · dados salvos apenas neste navegador</span></div>}
      <span className="sr-only" aria-live="polite">Seção atual: {current?.label ?? 'Início'}</span>
      <div className="workspace">
        <nav className="desktop-navigation" aria-label="Navegação principal">
          <p>{isAdmin ? 'Plataforma' : isBarber ? 'Painel' : 'Sua conta'}</p>
          {navigation.map((item) => <SectionLink item={item} key={item.path} />)}
        </nav>
        <div className="workspace-content">{children}</div>
      </div>
      <nav className="mobile-navigation" aria-label="Navegação principal">
        {visibleMobile.map((item) => <SectionLink item={item} key={item.path} />)}
        {overflowMobile.length > 0 && (
          <div className="more-navigation" ref={moreMenu}>
            {moreOpen && (
              <div className="more-menu">
                {overflowMobile.map((item) => <SectionLink item={item} key={item.path} />)}
              </div>
            )}
            <button type="button" aria-expanded={moreOpen} aria-haspopup="menu" onClick={() => setMoreOpen((open) => !open)}>
              <MoreHorizontal aria-hidden="true" /><span>Mais</span>
            </button>
          </div>
        )}
      </nav>
    </div>
  )
}

function SectionLink({ item }: { item: NavigationItem }) {
  return (
    <NavLink to={item.path} className={({ isActive }) => isActive ? 'section-link active' : 'section-link'} aria-label={item.label}>
      <span aria-hidden="true">{item.icon}</span>{item.label}
    </NavLink>
  )
}
