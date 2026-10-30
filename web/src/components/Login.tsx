import { ArrowRight, CalendarCheck, Eye, EyeOff, Lock, Mail, Scissors, ShieldCheck, Store, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { errorMessage, mockEnabled, repository } from '../lib/repository'
import type { User } from '../types'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs'

interface LoginProps {
  onAuthenticated: (user: User) => void
}

type Mode = 'login' | 'register'

const demoAccounts = [
  { label: 'Administrador', hint: 'admin · admin', identifier: 'admin', password: 'admin', icon: <ShieldCheck aria-hidden="true" /> },
  { label: 'Barbeiro', hint: 'rafael@demo.local', identifier: 'rafael@demo.local', password: 'demo1234', icon: <Scissors aria-hidden="true" /> },
  { label: 'Cliente', hint: 'marina@demo.local', identifier: 'marina@demo.local', password: 'demo1234', icon: <UserRound aria-hidden="true" /> },
]

const points = [
  { icon: <CalendarCheck aria-hidden="true" />, text: 'Clientes marcam sozinhos, a qualquer hora' },
  { icon: <Store aria-hidden="true" />, text: 'Cada barbearia com seu link, equipe e horários' },
  { icon: <ShieldCheck aria-hidden="true" />, text: 'Cadastro de estabelecimento liberado pelo administrador' },
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

  useEffect(() => {
    let active = true
    void repository.providers().then((providers) => active && setGoogle(providers.google))
    if (new URLSearchParams(window.location.search).get('login') === 'failed') setError('Não foi possível entrar com o Google. Tente novamente.')
    return () => { active = false }
  }, [])

  const switchMode = (next: string) => {
    setMode(next as Mode)
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
    <main className="grid min-h-screen bg-ink lg:grid-cols-[1.1fr_.9fr]">
      <section className="relative flex flex-col justify-between gap-3 overflow-hidden bg-[radial-gradient(circle_at_90%_8%,#d99b3244,transparent_34%),radial-gradient(circle_at_0%_100%,#d99b3222,transparent_38%),linear-gradient(145deg,#12110d,#26231a)] px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-5 text-paper before:pointer-events-none before:absolute before:inset-0 before:bg-[repeating-linear-gradient(120deg,transparent_0_23px,#fff_24px,transparent_25px)] before:opacity-10 lg:gap-8 lg:p-16" aria-labelledby="login-title">
        <div className="relative flex items-center gap-3 text-xs font-extrabold tracking-[.12em] uppercase">
          <span className="grid size-11 place-items-center rounded-full border border-white/20 bg-white/5 text-brand-light"><Scissors aria-hidden="true" /></span>
          Meu Barbeiro
        </div>
        <div className="relative max-w-2xl">
          <p className="mb-2 hidden text-[.72rem] font-extrabold tracking-[.16em] text-brand uppercase lg:block">Agenda cheia. Rotina leve.</p>
          <h1 id="login-title" className="font-serif text-[1.7rem] leading-[1.05] font-medium tracking-tight lg:mb-5 lg:text-7xl lg:leading-[.96]">Seu melhor corte começa antes da cadeira.</h1>
          <p className="mt-4 hidden max-w-lg text-lg leading-relaxed text-[#c9c2b4] lg:block">
            Agendamentos sem conversa perdida, horários sob controle e uma experiência à altura do seu trabalho.
          </p>
          <ul className="mt-8 hidden gap-3 lg:grid">
            {points.map((point) => (
              <li key={point.text} className="flex items-center gap-3 text-[#e4ddcc]">
                <span className="grid size-9 place-items-center rounded-[10px] bg-white/10 text-brand-light">{point.icon}</span>{point.text}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative hidden w-fit rounded-r-xl border-l-[3px] border-brand bg-white/5 px-5 py-3.5 lg:grid" aria-hidden="true">
          <span className="text-[.72rem] tracking-[.12em] text-[#968f80] uppercase">Hoje</span>
          <strong className="my-1 font-serif text-lg font-medium">8 horários organizados</strong>
          <small className="text-[.72rem] tracking-[.12em] text-[#968f80] uppercase">Sem papel. Sem conflito.</small>
        </div>
      </section>

      <section className="flex items-start justify-center bg-paper px-5 pt-5 pb-8 sm:px-12 sm:pt-12 lg:items-center" aria-label="Acesso">
        <div className="w-full max-w-[460px]">
          <Tabs value={mode} onValueChange={switchMode}>
            <TabsList aria-label="Acesso à conta" className="mb-5 lg:mb-7">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Criar conta</TabsTrigger>
            </TabsList>

            <h2 className="mb-2 font-serif text-3xl font-medium tracking-tight lg:text-4xl">{mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}</h2>
            <p className="mb-5 text-sm leading-relaxed text-muted lg:mb-6 lg:text-base">
              {mode === 'login'
                ? 'Um só acesso para clientes, barbeiros e administradores.'
                : 'É grátis para clientes. Barbeiros criam a conta e pedem a liberação do estabelecimento depois.'}
            </p>

            <TabsContent value={mode} forceMount>
              <form className="grid gap-4" onSubmit={submit}>
                {mode === 'register' && (
                  <Field label="Nome completo">
                    <Input icon={<UserRound />} autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Como devemos te chamar?" />
                  </Field>
                )}
                <Field label={mode === 'login' ? 'E-mail ou usuário' : 'E-mail'}>
                  <Input
                    icon={<Mail />} autoComplete={mode === 'login' ? 'username' : 'email'} required
                    type={mode === 'register' ? 'email' : 'text'} inputMode={mode === 'register' ? 'email' : undefined}
                    autoCapitalize="none" spellCheck={false} value={identifier} onChange={(event) => setIdentifier(event.target.value)}
                    placeholder={mode === 'login' ? 'voce@email.com ou admin' : 'voce@email.com'}
                  />
                </Field>
                <Field label="Senha">
                  <Input
                    icon={<Lock />} type={showPassword ? 'text' : 'password'} required maxLength={128}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password} onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === 'login' ? 'Sua senha' : 'Mínimo de 8 caracteres'}
                    trailing={(
                      <button type="button" className="grid size-11 place-items-center rounded-[11px] text-muted hover:bg-paper-deep hover:text-ink" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword}>
                        {showPassword ? <EyeOff className="size-[1.1rem]" aria-hidden="true" /> : <Eye className="size-[1.1rem]" aria-hidden="true" />}
                      </button>
                    )}
                  />
                </Field>

                {error && <p role="alert" className="rounded-xl border border-[#e8b9ae] bg-[#fdf0ec] px-4 py-3 text-sm font-semibold text-[#7b2d20]">{error}</p>}

                <Button type="submit" size="lg" block loading={busy}>
                  {busy ? (mode === 'login' ? 'Entrando…' : 'Criando conta…') : <>{mode === 'login' ? 'Entrar' : 'Criar conta'} <ArrowRight aria-hidden="true" /></>}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {google && (
            <>
              <Divider>ou</Divider>
              <Button variant="ghost" block onClick={() => repository.loginWithGoogle()}>Continuar com Google</Button>
            </>
          )}

          {mockEnabled && (
            <div className="mt-2">
              <Divider>ambiente de demonstração</Divider>
              <p className="mb-3.5 text-[.8rem] leading-normal text-muted">Toque para preencher uma conta de teste. O perfil é definido pelo cadastro, não por uma escolha na tela.</p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {demoAccounts.map((account) => (
                  <button
                    type="button" key={account.label} onClick={() => fillDemo(account)}
                    className="grid min-h-11 grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 rounded-xl border border-dashed border-[#cbbf9f] bg-surface p-3 text-left transition hover:-translate-y-0.5 hover:border-solid hover:border-brand hover:shadow-sm sm:grid-cols-1 sm:items-start sm:justify-items-start [&_svg]:size-[1.1rem] [&_svg]:text-brand-deep"
                  >
                    {account.icon}
                    <span className="grid min-w-0"><strong className="text-[.82rem]">{account.label}</strong><small className="truncate text-[.66rem] text-muted">{account.hint}</small></span>
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

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3 text-[.68rem] font-bold tracking-[.11em] text-[#958f83] uppercase before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
      <span>{children}</span>
    </div>
  )
}
