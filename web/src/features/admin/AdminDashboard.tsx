import { Building2, Check, Inbox, LoaderCircle, MapPin, Search, ShieldCheck, UserPlus, UsersRound, X } from 'lucide-react'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button, buttonStyles } from '../../components/ui/Button'
import { Card, PageHeader } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Field'
import { cn } from '../../lib/cn'
import { errorMessage, repository } from '../../lib/repository'
import type { AdminUser, EstablishmentRequestStatus } from '../../types'

const statusLabel: Record<EstablishmentRequestStatus, string> = {
  NONE: 'Sem solicitação', PENDING: 'Em análise', APPROVED: 'Liberado', REJECTED: 'Recusado',
}
const statusTone = { NONE: 'neutral', PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' } as const

const dateLabel = (value: string | null) => value
  ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  : '—'

const sections = ['visao', 'solicitacoes', 'estabelecimentos'] as const
type Decision = 'APPROVED' | 'REJECTED' | 'NONE'

const filters: Array<[EstablishmentRequestStatus | '', string]> = [['PENDING', 'Em análise'], ['APPROVED', 'Liberados'], ['REJECTED', 'Recusados'], ['', 'Todos']]

const useDebounced = <T,>(value: T, delay: number) => {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function AdminDashboard() {
  const { section } = useParams()
  const client = useQueryClient()
  const [filter, setFilter] = useState<EstablishmentRequestStatus | ''>('PENDING')
  const [query, setQuery] = useState('')
  const [email, setEmail] = useState('')
  const debouncedQuery = useDebounced(query, 250)

  const overviewQuery = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => repository.adminOverview() })
  const usersQuery = useQuery({
    queryKey: ['admin', 'users', filter, debouncedQuery],
    queryFn: () => repository.adminUsers({ ...(filter ? { status: filter } : {}), q: debouncedQuery }),
    placeholderData: keepPreviousData,
  })
  const shopsQuery = useQuery({ queryKey: ['admin', 'shops'], queryFn: () => repository.adminBarbershops() })

  const refresh = () => client.invalidateQueries({ queryKey: ['admin'] })

  const decision = useMutation({
    mutationFn: ({ user, decision }: { user: AdminUser; decision: Decision }) => repository.adminDecide(user.id, decision),
    onSuccess: (_data, { user, decision }) => {
      toast.success(decision === 'APPROVED' ? `${user.name} já pode cadastrar o estabelecimento.` : decision === 'REJECTED' ? `Solicitação de ${user.name} recusada.` : `Liberação de ${user.name} revogada.`)
      return refresh()
    },
    onError: (caught) => toast.error(errorMessage(caught, 'Não foi possível registrar a decisão.')),
  })

  const authorization = useMutation({
    mutationFn: (address: string) => repository.adminAuthorize(address),
    onSuccess: (_data, address) => {
      toast.success(`${address} foi autorizado a cadastrar um estabelecimento.`)
      setEmail('')
      return refresh()
    },
    onError: (caught) => toast.error(errorMessage(caught, 'Não foi possível autorizar.')),
  })

  if (!section || !sections.includes(section as typeof sections[number])) return <Navigate replace to="/admin/visao" />

  const users = usersQuery.data ?? []
  const shops = shopsQuery.data ?? []
  const overview = overviewQuery.data
  const busyId = decision.isPending ? decision.variables.user.id : null
  const loading = overviewQuery.isPending || usersQuery.isPending || shopsQuery.isPending
  const failure = overviewQuery.error ?? usersQuery.error ?? shopsQuery.error
  const error = failure ? errorMessage(failure, 'Não foi possível carregar o painel.') : null
  const onDecide = (user: AdminUser, next: Decision) => decision.mutate({ user, decision: next })
  const authorize = (event: React.FormEvent) => {
    event.preventDefault()
    authorization.mutate(email.trim())
  }

  const pending = users.filter((user) => user.establishmentRequest === 'PENDING')

  return (
    <main className="page-wrap section-page" data-section={section}>
      {section === 'visao' && <PageHeader eyebrow="Administração" title="Visão da plataforma.">Quem está na plataforma e quem aguarda liberação para cadastrar um estabelecimento.</PageHeader>}
      {section === 'solicitacoes' && <PageHeader eyebrow="Liberações" title="Quem pode cadastrar barbearias.">Aprove os barbeiros que pediram acesso ou autorize alguém direto pelo e-mail.</PageHeader>}
      {section === 'estabelecimentos' && <PageHeader eyebrow="Rede" title="Estabelecimentos cadastrados.">Todas as barbearias ativas na plataforma e seus responsáveis.</PageHeader>}

      {error && <p role="alert" className="mb-4 rounded-xl border border-[#e8b9ae] bg-[#fdf0ec] px-4 py-3 text-sm font-semibold text-[#7b2d20]">{error}</p>}
      {loading && <p className="flex items-center gap-2 text-muted"><LoaderCircle className="animate-spin" aria-hidden="true" /> Carregando…</p>}

      {!loading && section === 'visao' && overview && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Stat icon={<UsersRound />} value={overview.users} label="Contas" />
            <Stat icon={<Building2 />} value={overview.barbershops} label="Estabelecimentos" />
            <Stat icon={<Inbox />} value={overview.pendingRequests} label="Aguardando liberação" alert={overview.pendingRequests > 0} />
            <Stat icon={<ShieldCheck />} value={overview.activeSubscriptions} label="Assinaturas ativas" />
          </div>
          <Card as="section" aria-labelledby="pending-title">
            <div className="mb-5 flex items-center justify-between">
              <h2 id="pending-title" className="font-serif text-2xl font-medium tracking-tight">Pedidos pendentes</h2>
              <Badge tone="warning">{pending.length}</Badge>
            </div>
            {pending.length === 0 ? <p className="text-muted">Nenhuma solicitação aguardando. Tudo em dia.</p> : <RequestList users={pending} busyId={busyId} onDecide={onDecide} />}
            <Link className={cn(buttonStyles({ variant: 'ghost' }), 'mt-5')} to="/admin/solicitacoes">Ver todas as liberações</Link>
          </Card>
        </>
      )}

      {!loading && section === 'solicitacoes' && (
        <div className="flex flex-col gap-5">
          <Card as="form" className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-end" onSubmit={authorize}>
            <Field label="Autorizar por e-mail" className="flex-1">
              <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="barbeiro@email.com" />
            </Field>
            <Button type="submit" loading={authorization.isPending} disabled={!email}><UserPlus aria-hidden="true" /> Autorizar</Button>
          </Card>

          <Card as="section" aria-labelledby="requests-title">
            <h2 id="requests-title" className="mb-5 font-serif text-2xl font-medium tracking-tight">Contas</h2>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="min-w-60 flex-1">
                <Input icon={<Search />} type="search" aria-label="Buscar por nome ou e-mail" placeholder="Buscar por nome ou e-mail" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <div className="flex gap-1 overflow-x-auto rounded-xl bg-paper-deep p-1 [scrollbar-width:none]" role="group" aria-label="Filtrar por situação">
                {filters.map(([value, label]) => (
                  <button
                    type="button" key={label} aria-pressed={filter === value} onClick={() => setFilter(value)}
                    className="min-h-10 shrink-0 rounded-[9px] px-3.5 text-[.8rem] font-bold whitespace-nowrap text-muted transition aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-sm"
                  >{label}</button>
                ))}
              </div>
            </div>
            {users.length === 0 ? <p className="text-muted">Nenhuma conta neste filtro.</p> : <RequestList users={users} busyId={busyId} onDecide={onDecide} />}
          </Card>
        </div>
      )}

      {!loading && section === 'estabelecimentos' && (
        <Card as="section" aria-labelledby="shops-title">
          <div className="mb-5 flex items-center justify-between">
            <h2 id="shops-title" className="font-serif text-2xl font-medium tracking-tight">Barbearias</h2>
            <Badge tone="warning">{shops.length}</Badge>
          </div>
          <ShopGrid>
            {shops.map((shop) => (
              <article className="grid gap-2 rounded-xl border border-line bg-[#fdfbf6] p-5" key={shop.id}>
                <h3 className="font-serif text-xl font-medium">{shop.name}</h3>
                <code className="w-fit rounded-md bg-paper-deep px-1.5 py-0.5 text-xs">/b/{shop.slug}</code>
                {shop.address && <Meta icon={<MapPin />}>{shop.address}</Meta>}
                <Meta icon={<UserPlus />}>{shop.owner ? `${shop.owner.name}${shop.owner.email ? ` · ${shop.owner.email}` : ''}` : 'Sem responsável'}</Meta>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <Badge tone={shop.subscriptionStatus === 'ACTIVE' ? 'success' : 'neutral'}>{shop.subscriptionStatus === 'ACTIVE' ? 'Assinatura ativa' : 'Assinatura pendente'}</Badge>
                  <span>{shop.services} serviços · {shop.appointments} agendamentos</span>
                </div>
              </article>
            ))}
          </ShopGrid>
        </Card>
      )}
    </main>
  )
}

function ShopGrid({ children }: { children: React.ReactNode }) {
  const [ref] = useAutoAnimate<HTMLDivElement>()
  return <div ref={ref} className="grid gap-4 sm:grid-cols-[repeat(auto-fill,minmax(290px,1fr))]">{children}</div>
}

function Stat({ icon, value, label, alert }: { icon: React.ReactNode; value: number; label: string; alert?: boolean }) {
  return (
    <article className={cn('grid gap-0.5 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5', alert && 'border-[#cf9b40] bg-[#fff8e8]')}>
      <span className="mb-2 grid size-10 place-items-center rounded-xl bg-linear-to-br from-[#f7e3b6] to-[#efd08c] text-brand-deep [&_svg]:size-5" aria-hidden="true">{icon}</span>
      <strong className="font-serif text-4xl leading-none font-medium">{value}</strong>
      <span className="text-[.78rem] font-bold text-muted">{label}</span>
    </article>
  )
}

function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <p className="flex items-center gap-2 text-sm text-muted [&_svg]:size-4 [&_svg]:shrink-0"><span aria-hidden="true">{icon}</span>{children}</p>
}

function RequestList({ users, busyId, onDecide }: { users: AdminUser[]; busyId: string | null; onDecide: (user: AdminUser, decision: Decision) => void }) {
  const [parent] = useAutoAnimate<HTMLUListElement>()
  return (
    <ul ref={parent} className="grid gap-3.5">
      {users.map((user) => {
        const busy = busyId === user.id
        return (
          <li className="grid gap-3 rounded-xl border border-line bg-[#fdfbf6] p-4 transition hover:border-[#d7c9a4] hover:shadow-sm" key={user.id}>
            <div className="flex items-center gap-3">
              <Avatar name={user.name} />
              <div className="grid min-w-0 flex-1">
                <strong>{user.name}</strong>
                <small className="text-muted [overflow-wrap:anywhere]">{user.email || user.username}</small>
              </div>
              <Badge tone={statusTone[user.establishmentRequest]}>{statusLabel[user.establishmentRequest]}</Badge>
            </div>
            {user.establishmentRequestNote && <blockquote className="rounded-r-xl border-l-[3px] border-brand bg-[#f8f1df] px-4 py-3 text-sm text-[#4a463c]">{user.establishmentRequestNote}</blockquote>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <small>{user.establishmentRequestedAt ? `Pedido em ${dateLabel(user.establishmentRequestedAt)}` : `Conta criada em ${dateLabel(user.createdAt)}`}</small>
              {user.memberships.length > 0 && <small>{user.memberships.map((item) => item.barbershop.name).join(', ')}</small>}
            </div>
            {!user.platformAdmin && (
              <div className="flex flex-wrap gap-2.5 max-sm:[&>button]:flex-1">
                {user.establishmentRequest !== 'APPROVED' && <Button size="sm" disabled={busy} onClick={() => onDecide(user, 'APPROVED')}><Check aria-hidden="true" /> Aprovar</Button>}
                {user.establishmentRequest === 'PENDING' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide(user, 'REJECTED')}><X aria-hidden="true" /> Recusar</Button>}
                {user.establishmentRequest === 'APPROVED' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide(user, 'NONE')}>Revogar liberação</Button>}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
