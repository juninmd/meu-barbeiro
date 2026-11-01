import { Clipboard, Mail, ShieldCheck, UserMinus, UserPlus, UsersRound, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Field, Input, Select } from '../../components/ui/Field'
import { errorMessage, repository } from '../../lib/repository'
import type { Barbershop, CreatedInvitation, TeamMember, TeamResponse } from '../../types'

interface TeamPanelProps {
  barbershop: Barbershop
  currentUserId: string
}

const roleLabel: Record<string, string> = { OWNER: 'Dono', ADMIN: 'Administrador', BARBER: 'Barbeiro' }

export function TeamPanel({ barbershop, currentUserId }: TeamPanelProps) {
  const canManage = barbershop.membershipRole === 'OWNER' || barbershop.membershipRole === 'ADMIN'
  const isOwner = barbershop.membershipRole === 'OWNER'
  const [team, setTeam] = useState<TeamResponse | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'BARBER'>('BARBER')
  const [invited, setInvited] = useState<CreatedInvitation | null>(null)
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setTeam(await repository.team())
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível carregar a equipe'))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const invite = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const created = await repository.inviteMember(email.trim().toLowerCase(), role)
      setInvited(created)
      setEmail('')
      toast.success(created.emailDelivered ? `Convite enviado para ${created.email}.` : 'Convite criado. Copie o link e envie.')
      await load()
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível convidar'))
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (id: string) => {
    setBusy(true)
    try {
      await repository.revokeInvitation(id)
      toast.success('Convite cancelado.')
      await load()
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível cancelar o convite'))
    } finally {
      setBusy(false)
    }
  }

  const resend = async (id: string) => {
    setBusy(true)
    try {
      setInvited(await repository.resendInvitation(id))
      toast.success('Novo link gerado.')
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível reenviar'))
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (userId: string, next: 'ADMIN' | 'BARBER') => {
    setBusy(true)
    try {
      await repository.updateMemberRole(userId, next)
      await load()
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível alterar o papel'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!removeTarget) return
    setBusy(true)
    try {
      await repository.removeMember(removeTarget.userId)
      toast.success(`${removeTarget.name} saiu da equipe. O histórico foi mantido.`)
      setRemoveTarget(null)
      await load()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Não foi possível remover'))
    } finally {
      setBusy(false)
    }
  }

  const copyInvite = async () => {
    if (!invited) return
    try {
      await navigator.clipboard.writeText(invited.acceptUrl)
      toast.success('Link copiado.')
    } catch {
      toast.error('Selecione o link e copie manualmente.')
    }
  }

  if (!team) {
    return <Card><p className="text-muted">{error ?? 'Carregando equipe…'}</p></Card>
  }

  const limit = team.limits.professionals
  const limitReached = team.limits.remaining !== null && team.limits.remaining <= 0

  return (
    <div className="grid gap-5">
      <Card>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-[.72rem] font-extrabold tracking-[.14em] text-brand-deep uppercase">Quem atende</p>
            <h2 className="font-serif text-2xl">Equipe</h2>
          </div>
          <Badge tone={limitReached ? 'warning' : 'neutral'}>{team.limits.used}/{limit ?? '∞'}</Badge>
        </div>

        {error && <p className="mb-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-ink" role="alert">{error}</p>}

        <ul className="grid gap-1">
          {team.members.map((member) => (
            <li key={member.userId} className="flex flex-wrap items-center gap-3 border-b border-line/70 py-3 last:border-0">
              <span className="grid size-10 place-items-center rounded-full bg-ink text-sm font-black text-paper" aria-hidden="true">{member.name.slice(0, 1)}</span>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-sm">{member.name}{member.userId === currentUserId && <span className="font-normal text-muted"> (você)</span>}</strong>
                <span className="block truncate text-xs text-muted">{member.email ?? member.phone ?? 'sem contato'}</span>
              </div>
              {isOwner && member.role !== 'OWNER' ? (
                <Select aria-label={`Papel de ${member.name}`} value={member.role} disabled={busy} onChange={(event) => void changeRole(member.userId, event.target.value as 'ADMIN' | 'BARBER')} className="w-auto">
                  <option value="BARBER">Barbeiro</option>
                  <option value="ADMIN">Administrador</option>
                </Select>
              ) : (
                <Badge tone={member.role === 'OWNER' ? 'warning' : 'neutral'}><ShieldCheck aria-hidden="true" className="mr-1 size-3" />{roleLabel[member.role]}</Badge>
              )}
              {canManage && member.role !== 'OWNER' && member.userId !== currentUserId && (
                <button type="button" className="grid size-11 place-items-center rounded-xl border border-line text-muted hover:border-danger hover:text-danger" aria-label={`Remover ${member.name}`} disabled={busy} onClick={() => setRemoveTarget(member)}>
                  <UserMinus aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>

        {canManage && (
          <form className="mt-5 grid gap-3 rounded-xl border border-dashed border-line bg-surface-2 p-4" onSubmit={invite}>
            <h3 className="flex items-center gap-2 font-serif text-lg"><UserPlus aria-hidden="true" /> Convidar para a equipe</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="E-mail">
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="barbeiro@email.com" required maxLength={160} />
              </Field>
              <Field label="Papel">
                <Select value={role} onChange={(event) => setRole(event.target.value as 'ADMIN' | 'BARBER')}>
                  <option value="BARBER">Barbeiro — vê a própria agenda</option>
                  <option value="ADMIN">Administrador — vê tudo e edita</option>
                </Select>
              </Field>
            </div>
            <Button type="submit" variant="dark" disabled={busy || limitReached} loading={busy}>
              <Mail aria-hidden="true" /> {limitReached ? 'Limite do plano atingido' : 'Enviar convite'}
            </Button>
            {limitReached && (
              <p className="text-xs text-muted">Seu plano permite {limit} profissional{limit === 1 ? '' : 'is'}. Faça upgrade na aba Assinatura para convidar mais gente.</p>
            )}
          </form>
        )}

        {invited && (
          <div className="mt-4 grid gap-2 rounded-xl border border-brand/40 bg-brand/10 p-4">
            <p className="text-sm font-bold">Link do convite para {invited.email} (expira em {new Date(invited.expiresAt).toLocaleDateString('pt-BR')})</p>
            <code className="overflow-wrap-anywhere text-xs">{invited.acceptUrl}</code>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="ghost" onClick={() => void copyInvite()}><Clipboard aria-hidden="true" /> Copiar link</Button>
              <small className="text-xs text-muted">{invited.emailDelivered ? `Enviado por ${invited.emailProvider}.` : 'Nenhum provedor de e-mail configurado: envie manualmente.'}</small>
            </div>
          </div>
        )}
      </Card>

      {team.invitations.length > 0 && (
        <Card>
          <h3 className="mb-3 flex items-center gap-2 font-serif text-lg"><UsersRound aria-hidden="true" /> Convites pendentes</h3>
          <ul className="grid gap-2">
            {team.invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 py-2 last:border-0">
                <div>
                  <strong className="block text-sm">{invitation.email}</strong>
                  <span className="text-xs text-muted">{roleLabel[invitation.role]} · expira em {new Date(invitation.expiresAt).toLocaleDateString('pt-BR')}</span>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void resend(invitation.id)}>Reenviar</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void revoke(invitation.id)}><X aria-hidden="true" /> Cancelar</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {removeTarget && (
        <ConfirmDialog
          eyebrow="Remover da equipe"
          title={`Remover ${removeTarget.name}?`}
          description="A pessoa perde o acesso. O histórico de atendimentos e comissões continua nos relatórios."
          cancelLabel="Manter na equipe"
          confirmLabel={busy ? 'Removendo…' : 'Sim, remover'}
          busy={busy}
          onCancel={() => setRemoveTarget(null)}
          onConfirm={remove}
        />
      )}
    </div>
  )
}
