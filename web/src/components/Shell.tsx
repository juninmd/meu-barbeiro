import { LogOut, Scissors, ShieldCheck } from 'lucide-react'
import { mockEnabled } from '../lib/repository'
import type { Role, User } from '../types'

interface ShellProps {
  user: User
  children: React.ReactNode
  onLogout: () => void
  onSwitchRole: (role: Role) => void
}

export function Shell({ user, children, onLogout, onSwitchRole }: ShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Meu Barbeiro - início">
          <span className="brand-icon"><Scissors aria-hidden="true" /></span>
          <span><strong>MEU</strong> BARBEIRO</span>
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
            <small>{user.role === 'BARBER' ? 'Profissional' : 'Cliente'}</small>
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
