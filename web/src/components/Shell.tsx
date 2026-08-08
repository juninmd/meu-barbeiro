import {
  CalendarDays,
  CircleDollarSign,
  Clock3,
  LogOut,
  MoreHorizontal,
  Package,
  Scissors,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { mockEnabled } from '../lib/repository'
import type { Barbershop, Role, User } from '../types'

interface ShellProps {
  user: User
  barbershop: Barbershop | null
  children: React.ReactNode
  onLogout: () => void
  onSwitchRole: (role: Role) => void
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
]

const barberNavigation: NavigationItem[] = [
  { label: 'Hoje', path: '/barbeiro/hoje', icon: <Clock3 /> },
  { label: 'Agenda', path: '/barbeiro/agenda', icon: <CalendarDays /> },
  { label: 'Clientes', path: '/barbeiro/clientes', icon: <UsersRound /> },
  { label: 'Produtos', path: '/barbeiro/produtos', icon: <Package /> },
  { label: 'Financeiro', path: '/barbeiro/financeiro', icon: <CircleDollarSign /> },
  { label: 'Ajustes', path: '/barbeiro/ajustes', icon: <Settings /> },
]

export function Shell({ user, barbershop, children, onLogout, onSwitchRole }: ShellProps) {
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreMenu = useRef<HTMLDivElement>(null)
  const isBarber = user.role === 'BARBER' || user.role === 'ADMIN'
  const canManage = barbershop?.membershipRole === 'OWNER' || barbershop?.membershipRole === 'ADMIN'
  const navigation = isBarber
    ? barberNavigation.filter((item) => canManage || (item.label !== 'Financeiro' && item.label !== 'Ajustes'))
    : clientNavigation
  const visibleMobile = isBarber ? navigation.slice(0, 4) : navigation
  const overflowMobile = isBarber ? navigation.slice(4) : []
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
        <NavLink className="brand" to={isBarber ? '/barbeiro/hoje' : '/cliente/horarios'} aria-label="Meu Barbeiro - início">
          <span className="brand-icon">
            {barbershop?.logoUrl ? <img src={barbershop.logoUrl} alt="" /> : <Scissors aria-hidden="true" />}
          </span>
          <span>{barbershop?.name || <><strong>MEU</strong> BARBEIRO</>}</span>
        </NavLink>
        <div className="profile-actions">
          {mockEnabled && (
            <label className="role-switch">
              <ShieldCheck aria-hidden="true" />
              <span className="sr-only">Trocar perfil mock</span>
              <select value={user.role} onChange={(event) => onSwitchRole(event.target.value as Role)}>
                <option value="CUSTOMER">Cliente mock</option>
                <option value="BARBER">Barbeiro mock</option>
              </select>
            </label>
          )}
          <div className="profile-copy">
            <strong>{user.name}</strong>
            <small>{user.role === 'CUSTOMER' ? 'Cliente' : barbershop?.membershipRole === 'BARBER' ? 'Contratado' : 'Gestão'}</small>
          </div>
          <button className="icon-button" onClick={onLogout} aria-label="Sair">
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </header>
      {mockEnabled && <div className="dev-ribbon">Modo desenvolvimento · alterações salvas apenas neste navegador</div>}
      <span className="sr-only" aria-live="polite">Seção atual: {current?.label ?? 'Início'}</span>
      <div className="workspace">
        <nav className="desktop-navigation" aria-label="Navegação principal">
          <p>{isBarber ? 'Painel' : 'Sua conta'}</p>
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
