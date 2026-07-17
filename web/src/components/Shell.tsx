import { LogOut, Scissors, ShieldCheck } from 'lucide-react'
import { mockEnabled } from '../lib/repository'
import type { Barbershop, Role, User } from '../types'

interface ShellProps {
  user: User
  barbershop: Barbershop | null
  children: React.ReactNode
  onLogout: () => void
  onSwitchRole: (role: Role) => void
}

export function Shell({ user, barbershop, children, onLogout, onSwitchRole }: ShellProps) {
  return (
    <div className="app-shell" style={{ '--amber': barbershop?.primaryColor || '#d99b32' } as React.CSSProperties}>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Meu Barbeiro - início">
          <span className="brand-icon">
            {barbershop?.logoUrl ? <img src={barbershop.logoUrl} alt="" /> : <Scissors aria-hidden="true" />}
          </span>
          <span>{barbershop?.name || <><strong>MEU</strong> BARBEIRO</>}</span>
        </a>
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
            <small>{user.role === 'CUSTOMER' ? 'Cliente' : 'Gestão'}</small>
          </div>
          <button className="icon-button" onClick={onLogout} aria-label="Sair">
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </header>
      {mockEnabled && <div className="dev-ribbon">Modo desenvolvimento · alterações salvas apenas neste navegador</div>}
      {children}
    </div>
  )
}
