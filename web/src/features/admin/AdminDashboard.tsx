import { Building2, Check, Inbox, LoaderCircle, MapPin, Search, ShieldCheck, UserPlus, UsersRound, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { errorMessage, repository } from '../../lib/repository'
import type { AdminBarbershop, AdminOverview, AdminUser, EstablishmentRequestStatus } from '../../types'

const statusLabel: Record<EstablishmentRequestStatus, string> = {
  NONE: 'Sem solicitação', PENDING: 'Em análise', APPROVED: 'Liberado', REJECTED: 'Recusado',
}

const dateLabel = (value: string | null) => value
  ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  : '—'

const sections = ['visao', 'solicitacoes', 'estabelecimentos'] as const

export function AdminDashboard() {
  const { section } = useParams()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [shops, setShops] = useState<AdminBarbershop[]>([])
  const [filter, setFilter] = useState<EstablishmentRequestStatus | ''>('PENDING')
  const [query, setQuery] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextOverview, nextUsers, nextShops] = await Promise.all([
        repository.adminOverview(),
        repository.adminUsers({ ...(filter ? { status: filter } : {}), q: query }),
        repository.adminBarbershops(),
      ])
      setOverview(nextOverview)
      setUsers(nextUsers)
      setShops(nextShops)
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível carregar o painel.'))
    } finally {
      setLoading(false)
    }
  }, [filter, query])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), query ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [load, query])

  if (!section || !sections.includes(section as typeof sections[number])) return <Navigate replace to="/admin/visao" />

  const decide = async (user: AdminUser, decision: 'APPROVED' | 'REJECTED' | 'NONE') => {
    setBusyId(user.id)
    setNotice(null)
    try {
      await repository.adminDecide(user.id, decision)
      setNotice(decision === 'APPROVED' ? `${user.name} já pode cadastrar o estabelecimento.` : decision === 'REJECTED' ? `Solicitação de ${user.name} recusada.` : `Liberação de ${user.name} revogada.`)
      await load()
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível registrar a decisão.'))
    } finally {
      setBusyId(null)
    }
  }

  const authorize = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusyId('authorize')
    setNotice(null)
    setError(null)
    try {
      await repository.adminAuthorize(email.trim())
      setNotice(`${email.trim()} foi autorizado a cadastrar um estabelecimento.`)
      setEmail('')
      await load()
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível autorizar.'))
    } finally {
      setBusyId(null)
    }
  }

  const pending = users.filter((user) => user.establishmentRequest === 'PENDING')

  return (
    <main className="page-wrap section-page" data-section={section}>
      {section === 'visao' && (
        <header className="page-heading"><p className="eyebrow">Administração</p><h1>Visão da plataforma.</h1><p>Quem está na plataforma e quem aguarda liberação para cadastrar um estabelecimento.</p></header>
      )}
      {section === 'solicitacoes' && (
        <header className="page-heading"><p className="eyebrow">Liberações</p><h1>Quem pode cadastrar barbearias.</h1><p>Aprove os barbeiros que pediram acesso ou autorize alguém direto pelo e-mail.</p></header>
      )}
      {section === 'estabelecimentos' && (
        <header className="page-heading"><p className="eyebrow">Rede</p><h1>Estabelecimentos cadastrados.</h1><p>Todas as barbearias ativas na plataforma e seus responsáveis.</p></header>
      )}

      {error && <p className="auth-error" role="alert">{error}</p>}
      {notice && <p className="form-message" role="status">{notice}</p>}
      {loading && <p className="empty-copy"><LoaderCircle className="spin" aria-hidden="true" /> Carregando…</p>}

      {!loading && section === 'visao' && overview && (
        <>
          <div className="stat-grid">
            <article className="stat"><UsersRound aria-hidden="true" /><strong>{overview.users}</strong><span>Contas</span></article>
            <article className="stat"><Building2 aria-hidden="true" /><strong>{overview.barbershops}</strong><span>Estabelecimentos</span></article>
            <article className={`stat ${overview.pendingRequests ? 'stat-alert' : ''}`}><Inbox aria-hidden="true" /><strong>{overview.pendingRequests}</strong><span>Aguardando liberação</span></article>
            <article className="stat"><ShieldCheck aria-hidden="true" /><strong>{overview.activeSubscriptions}</strong><span>Assinaturas ativas</span></article>
          </div>
          <section className="panel" aria-labelledby="pending-title">
            <div className="section-heading compact"><h2 id="pending-title">Pedidos pendentes</h2><span className="count-badge">{pending.length}</span></div>
            {pending.length === 0 ? <p className="empty-copy">Nenhuma solicitação aguardando. Tudo em dia.</p> : <RequestList users={pending} busyId={busyId} onDecide={decide} />}
            <Link className="button button-ghost section-primary-action" to="/admin/solicitacoes">Ver todas as liberações</Link>
          </section>
        </>
      )}

      {!loading && section === 'solicitacoes' && (
        <>
          <form className="panel inline-form" onSubmit={authorize}>
            <div className="field">
              <label htmlFor="authorize-email">Autorizar por e-mail</label>
              <input id="authorize-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="barbeiro@email.com" />
            </div>
            <button className="button button-primary" type="submit" disabled={busyId === 'authorize' || !email}>
              {busyId === 'authorize' ? <LoaderCircle className="spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />} Autorizar
            </button>
          </form>

          <section className="panel" aria-labelledby="requests-title">
            <div className="section-heading compact"><h2 id="requests-title">Contas</h2></div>
            <div className="toolbar">
              <div className="input-wrap"><Search aria-hidden="true" />
                <input type="search" aria-label="Buscar por nome ou e-mail" placeholder="Buscar por nome ou e-mail" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <div className="segmented" role="group" aria-label="Filtrar por situação">
                {([['PENDING', 'Em análise'], ['APPROVED', 'Liberados'], ['REJECTED', 'Recusados'], ['', 'Todos']] as const).map(([value, label]) => (
                  <button type="button" key={label} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
                ))}
              </div>
            </div>
            {users.length === 0 ? <p className="empty-copy">Nenhuma conta neste filtro.</p> : <RequestList users={users} busyId={busyId} onDecide={decide} />}
          </section>
        </>
      )}

      {!loading && section === 'estabelecimentos' && (
        <section className="panel" aria-labelledby="shops-title">
          <div className="section-heading compact"><h2 id="shops-title">Barbearias</h2><span className="count-badge">{shops.length}</span></div>
          <div className="shop-grid">
            {shops.map((shop) => (
              <article className="shop-card" key={shop.id}>
                <h3>{shop.name}</h3>
                <p className="muted"><code>/b/{shop.slug}</code></p>
                {shop.address && <p><MapPin aria-hidden="true" /> {shop.address}</p>}
                <p><UserPlus aria-hidden="true" /> {shop.owner ? `${shop.owner.name}${shop.owner.email ? ` · ${shop.owner.email}` : ''}` : 'Sem responsável'}</p>
                <div className="shop-meta"><span className={`status ${shop.subscriptionStatus === 'ACTIVE' ? 'status-active' : 'status-inactive'}`}>{shop.subscriptionStatus === 'ACTIVE' ? 'Assinatura ativa' : 'Assinatura pendente'}</span><span>{shop.services} serviços · {shop.appointments} agendamentos</span></div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

function RequestList({ users, busyId, onDecide }: { users: AdminUser[]; busyId: string | null; onDecide: (user: AdminUser, decision: 'APPROVED' | 'REJECTED' | 'NONE') => void }) {
  return (
    <ul className="request-list">
      {users.map((user) => {
        const busy = busyId === user.id
        return (
          <li className="request-card" key={user.id}>
            <div className="request-who">
              <span className="avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{user.name}</strong>
                <small>{user.email || user.username}</small>
              </div>
              <span className={`status status-${user.establishmentRequest === 'APPROVED' ? 'active' : user.establishmentRequest === 'PENDING' ? 'pending' : user.establishmentRequest === 'REJECTED' ? 'cancelled' : 'inactive'}`}>{statusLabel[user.establishmentRequest]}</span>
            </div>
            {user.establishmentRequestNote && <blockquote>{user.establishmentRequestNote}</blockquote>}
            <div className="request-meta">
              <small>{user.establishmentRequestedAt ? `Pedido em ${dateLabel(user.establishmentRequestedAt)}` : `Conta criada em ${dateLabel(user.createdAt)}`}</small>
              {user.memberships.length > 0 && <small>{user.memberships.map((item) => item.barbershop.name).join(', ')}</small>}
            </div>
            {!user.platformAdmin && (
              <div className="request-actions">
                {user.establishmentRequest !== 'APPROVED' && (
                  <button className="button button-primary button-small" disabled={busy} onClick={() => onDecide(user, 'APPROVED')}><Check aria-hidden="true" /> Aprovar</button>
                )}
                {user.establishmentRequest === 'PENDING' && (
                  <button className="button button-ghost button-small" disabled={busy} onClick={() => onDecide(user, 'REJECTED')}><X aria-hidden="true" /> Recusar</button>
                )}
                {user.establishmentRequest === 'APPROVED' && (
                  <button className="button button-ghost button-small" disabled={busy} onClick={() => onDecide(user, 'NONE')}>Revogar liberação</button>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
