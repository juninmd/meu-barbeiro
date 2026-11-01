import { ArrowRight, Check, CircleAlert, MailCheck, Scissors } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { errorMessage, repository } from '../../lib/repository'
import type { InvitationPreview, User } from '../../types'

interface InvitationPageProps {
  user: User | null
  onLogin: () => void
  onLogout: () => Promise<void>
}

const roleLabel: Record<string, string> = { OWNER: 'Dono', ADMIN: 'Administrador', BARBER: 'Barbeiro' }

export function InvitationPage({ user, onLogin, onLogout }: InvitationPageProps) {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<InvitationPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    if (!token) return
    repository.invitationPreview(token)
      .then(setPreview)
      .catch((caught) => setError(errorMessage(caught, 'Convite inválido ou expirado')))
  }, [token])

  const accept = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await repository.acceptInvitation(token)
      setAccepted(true)
      toastSuccess()
      setTimeout(() => window.location.assign(`/b/${result.barbershop.slug}/barbeiro/hoje`), 900)
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível aceitar o convite'))
    } finally {
      setBusy(false)
    }
  }

  if (error && !preview) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper p-5">
        <Card className="w-full max-w-lg text-center">
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full border border-line text-brand-deep"><Scissors aria-hidden="true" /></span>
          <h1 className="mb-2 font-serif text-3xl">Este convite não está disponível</h1>
          <p className="mb-4 flex items-center justify-center gap-1.5 text-sm text-danger-ink" role="alert"><CircleAlert aria-hidden="true" className="size-4" /> {error}</p>
          <p className="mb-5 text-sm text-muted">Peça um novo convite para o dono da barbearia.</p>
          <Button variant="ghost" onClick={() => navigate('/')}>Ir para o início</Button>
        </Card>
      </main>
    )
  }

  if (!preview) {
    return <main className="grid min-h-screen place-items-center bg-paper p-5 text-muted">Conferindo o convite…</main>
  }

  const usable = preview.state === 'PENDING'
  const emailMatches = Boolean(user?.email && user.email.toLowerCase() === preview.email.toLowerCase())

  return (
    <main className="grid min-h-screen place-items-center bg-paper p-5">
      <Card className="w-full max-w-lg">
        <span className="mb-3 grid size-12 place-items-center rounded-full border border-line text-brand-deep"><MailCheck aria-hidden="true" /></span>
        <p className="mb-1 text-[.72rem] font-extrabold tracking-[.14em] text-brand-deep uppercase">Convite de equipe</p>
        <h1 className="mb-3 font-serif text-3xl">Entrar em {preview.barbershop.name}</h1>
        <p className="mb-4 text-sm text-muted">
          <b>{preview.invitedByName}</b> convidou <b>{preview.email}</b> para participar como <b>{roleLabel[preview.role]}</b>.
        </p>

        {!usable && (
          <p className="mb-4 flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-ink" role="alert">
            <CircleAlert aria-hidden="true" className="size-4" /> Este convite está {preview.state === 'EXPIRED' ? 'expirado' : preview.state === 'ACCEPTED' ? 'já aceito' : 'cancelado'}. Peça um novo ao dono.
          </p>
        )}

        {usable && !user && (
          <>
            <Button block onClick={onLogin}>Entrar para aceitar <ArrowRight aria-hidden="true" /></Button>
            <p className="mt-3 text-xs text-muted">Entre com o e-mail {preview.email} e abra este link novamente para confirmar.</p>
          </>
        )}

        {usable && user && !emailMatches && (
          <>
            <p className="mb-3 flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-ink" role="alert">
              <CircleAlert aria-hidden="true" className="size-4" /> Você está logado como {user.email ?? user.name}. O convite é para {preview.email}.
            </p>
            <Button block variant="dark" onClick={() => { void onLogout().then(onLogin) }}>Trocar de conta</Button>
          </>
        )}

        {usable && user && emailMatches && !accepted && (
          <Button block loading={busy} onClick={accept}>Aceitar convite <ArrowRight aria-hidden="true" /></Button>
        )}

        {accepted && <p className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-sm text-success-ink" role="status"><Check aria-hidden="true" className="size-4" /> Convite aceito. Abrindo o painel…</p>}

        <p className="mt-3 text-xs text-muted">Ao aceitar, você passa a ver a agenda desta barbearia conforme o papel atribuído.</p>
      </Card>
    </main>
  )
}

function toastSuccess() {
  void import('sonner').then(({ toast }) => toast.success('Convite aceito.'))
}
