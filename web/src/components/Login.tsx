import { ArrowRight, CalendarCheck, Eye, EyeOff, LoaderCircle, Lock, Mail, Scissors, ShieldCheck, Store, UserRound } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { errorMessage, mockEnabled, repository } from '../lib/repository'
import type { User } from '../types'

interface LoginProps {
  onAuthenticated: (user: User) => void
}

type Mode = 'login' | 'register'

const demoAccounts = [
  { label: 'Administrador', hint: 'admin · admin', identifier: 'admin', password: 'admin', icon: <ShieldCheck aria-hidden="true" /> },
  { label: 'Barbeiro', hint: 'rafael@demo.local', identifier: 'rafael@demo.local', password: 'demo1234', icon: <Scissors aria-hidden="true" /> },
  { label: 'Cliente', hint: 'marina@demo.local', identifier: 'marina@demo.local', password: 'demo1234', icon: <UserRound aria-hidden="true" /> },
]

export function Login({ onAuthenticated }: LoginProps) {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [google, setGoogle] = useState(false)
  const ids = { name: useId(), identifier: useId(), password: useId(), error: useId() }

  useEffect(() => {
    let active = true
    void repository.providers().then((providers) => active && setGoogle(providers.google))
    if (new URLSearchParams(window.location.search).get('login') === 'failed') setError('Não foi possível entrar com o Google. Tente novamente.')
    return () => { active = false }
  }, [])

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setShowPassword(false)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError(null)
    if (mode === 'register' && password.length < 8) {
      setError('Use uma senha com pelo menos 8 caracteres.')
      return
    }
    setBusy(true)
    try {
      const user = mode === 'login'
        ? await repository.login(identifier.trim(), password)
        : await repository.register({ name: name.trim(), email: identifier.trim(), password })
      onAuthenticated(user)
    } catch (caught) {
      setError(errorMessage(caught, mode === 'login' ? 'Não foi possível entrar. Tente novamente.' : 'Não foi possível criar a conta. Tente novamente.'))
      setBusy(false)
    }
  }

  const fillDemo = (account: typeof demoAccounts[number]) => {
    setMode('login')
    setIdentifier(account.identifier)
    setPassword(account.password)
    setError(null)
  }

  return (
    <main className="auth-shell">
      <section className="auth-story" aria-labelledby="login-title">
        <div className="auth-brand"><span className="brand-mark"><Scissors aria-hidden="true" /></span> Meu Barbeiro</div>
        <div className="auth-story-body">
          <p className="eyebrow">Agenda cheia. Rotina leve.</p>
          <h1 id="login-title">Seu melhor corte começa antes da cadeira.</h1>
          <p className="auth-lead">Agendamentos sem conversa perdida, horários sob controle e uma experiência à altura do seu trabalho.</p>
          <ul className="auth-points">
            <li><CalendarCheck aria-hidden="true" /> Clientes marcam sozinhos, a qualquer hora</li>
            <li><Store aria-hidden="true" /> Cada barbearia com seu link, equipe e horários</li>
            <li><ShieldCheck aria-hidden="true" /> Cadastro de estabelecimento liberado pelo administrador</li>
          </ul>
        </div>
        <div className="auth-preview" aria-hidden="true">
          <span>Hoje</span><strong>8 horários organizados</strong><small>Sem papel. Sem conflito.</small>
        </div>
      </section>

      <section className="auth-panel" aria-label="Acesso">
        <div className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Acesso à conta">
            <button type="button" role="tab" id="tab-login" aria-selected={mode === 'login'} aria-controls="auth-form" onClick={() => switchMode('login')}>Entrar</button>
            <button type="button" role="tab" id="tab-register" aria-selected={mode === 'register'} aria-controls="auth-form" onClick={() => switchMode('register')}>Criar conta</button>
          </div>

          <h2>{mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}</h2>
          <p className="auth-sub">
            {mode === 'login'
              ? 'Um só acesso para clientes, barbeiros e administradores.'
              : 'É grátis para clientes. Barbeiros criam a conta e pedem a liberação do estabelecimento depois.'}
          </p>

          <form id="auth-form" className="auth-form" role="tabpanel" aria-labelledby={mode === 'login' ? 'tab-login' : 'tab-register'} onSubmit={submit} noValidate={false}>
            {mode === 'register' && (
              <div className="field">
                <label htmlFor={ids.name}>Nome completo</label>
                <div className="input-wrap"><UserRound aria-hidden="true" />
                  <input id={ids.name} autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Como devemos te chamar?" />
                </div>
              </div>
            )}
            <div className="field">
              <label htmlFor={ids.identifier}>{mode === 'login' ? 'E-mail ou usuário' : 'E-mail'}</label>
              <div className="input-wrap"><Mail aria-hidden="true" />
                <input
                  id={ids.identifier} autoComplete={mode === 'login' ? 'username' : 'email'} required
                  type={mode === 'register' ? 'email' : 'text'} inputMode={mode === 'register' ? 'email' : undefined}
                  autoCapitalize="none" spellCheck={false} value={identifier} onChange={(event) => setIdentifier(event.target.value)}
                  placeholder={mode === 'login' ? 'voce@email.com ou admin' : 'voce@email.com'}
                  aria-describedby={error ? ids.error : undefined}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor={ids.password}>Senha</label>
              <div className="input-wrap"><Lock aria-hidden="true" />
                <input
                  id={ids.password} type={showPassword ? 'text' : 'password'} required maxLength={128}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password} onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'login' ? 'Sua senha' : 'Mínimo de 8 caracteres'}
                  aria-describedby={error ? ids.error : undefined}
                />
                <button type="button" className="reveal" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && <p className="auth-error" id={ids.error} role="alert">{error}</p>}

            <button className="button button-primary button-wide" type="submit" disabled={busy}>
              {busy ? <><LoaderCircle className="spin" aria-hidden="true" /> {mode === 'login' ? 'Entrando…' : 'Criando conta…'}</>
                : <>{mode === 'login' ? 'Entrar' : 'Criar conta'} <ArrowRight aria-hidden="true" /></>}
            </button>
          </form>

          {google && (
            <>
              <div className="divider"><span>ou</span></div>
              <button type="button" className="button button-ghost button-wide" onClick={() => repository.loginWithGoogle()}>Continuar com Google</button>
            </>
          )}

          {mockEnabled && (
            <div className="demo-access">
              <div className="divider"><span>ambiente de demonstração</span></div>
              <p className="demo-note">Toque para preencher uma conta de teste. O perfil é definido pelo cadastro, não por uma escolha na tela.</p>
              <div className="demo-grid">
                {demoAccounts.map((account) => (
                  <button type="button" className="demo-chip" key={account.label} onClick={() => fillDemo(account)}>
                    {account.icon}<span><strong>{account.label}</strong><small>{account.hint}</small></span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
