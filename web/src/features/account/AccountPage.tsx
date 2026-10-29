import { KeyRound, LoaderCircle, Mail, ShieldCheck, Store, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage, repository } from '../../lib/repository'
import type { User } from '../../types'

const roleLabel = (user: User) => user.platformAdmin ? 'Administrador da plataforma'
  : user.role === 'CUSTOMER' ? 'Cliente' : 'Barbeiro / gestão'

export function AccountPage({ user }: { user: User }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await repository.changePassword(current, next)
      setCurrent('')
      setNext('')
      setMessage({ kind: 'ok', text: 'Senha atualizada.' })
    } catch (caught) {
      setMessage({ kind: 'error', text: errorMessage(caught, 'Não foi possível trocar a senha.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page-wrap section-page">
      <header className="page-heading"><p className="eyebrow">Minha conta</p><h1>Seus dados e segurança.</h1><p>Um único acesso para todas as suas funções na plataforma.</p></header>
      <div className="profile-grid">
        <section className="panel account-card" aria-labelledby="account-id">
          <div className="avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</div>
          <h2 id="account-id">{user.name}</h2>
          <dl className="detail-list">
            <div><dt><UserRound aria-hidden="true" /> Perfil</dt><dd>{roleLabel(user)}</dd></div>
            <div><dt><Mail aria-hidden="true" /> {user.email ? 'E-mail' : 'Usuário'}</dt><dd>{user.email || user.username}</dd></div>
            {user.establishments?.map((item) => <div key={item.slug}><dt><Store aria-hidden="true" /> Estabelecimento</dt><dd>{item.name}</dd></div>)}
          </dl>
          {user.platformAdmin
            ? <p className="form-message"><ShieldCheck aria-hidden="true" /> Você aprova quem pode cadastrar estabelecimentos.</p>
            : user.role === 'CUSTOMER' && <Link className="button button-ghost" to="/cliente/negocio"><Store aria-hidden="true" /> Sou barbeiro: cadastrar meu estabelecimento</Link>}
        </section>

        <form className="panel form-card" onSubmit={submit}>
          <div className="section-heading compact"><h2><KeyRound aria-hidden="true" /> Trocar senha</h2></div>
          <div className="field"><label htmlFor="current-password">Senha atual</label>
            <input id="current-password" type="password" autoComplete="current-password" required value={current} onChange={(event) => setCurrent(event.target.value)} /></div>
          <div className="field"><label htmlFor="new-password">Nova senha</label>
            <input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={next} onChange={(event) => setNext(event.target.value)} />
            <small>Mínimo de 8 caracteres.</small></div>
          {message && <p className={message.kind === 'ok' ? 'form-message' : 'auth-error'} role={message.kind === 'ok' ? 'status' : 'alert'}>{message.text}</p>}
          <button className="button button-dark" type="submit" disabled={busy || next.length < 8 || !current}>
            {busy && <LoaderCircle className="spin" aria-hidden="true" />} Atualizar senha
          </button>
        </form>
      </div>
    </main>
  )
}
