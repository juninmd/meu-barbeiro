import { ArrowRight, Check, Clipboard, Rocket } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { errorMessage, repository } from '../../lib/repository'
import type { OnboardingResponse } from '../../types'

const sectionByAction: Record<string, string> = {
  ajustes: '/barbeiro/ajustes',
  equipe: '/barbeiro/equipe',
  assinatura: '/barbeiro/assinatura',
}

/** Checklist de ativação no topo do dia. Some quando a configuração termina. */
export function OnboardingChecklist() {
  const navigate = useNavigate()
  const [data, setData] = useState<OnboardingResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    repository.onboarding().then(setData).catch(() => setData(null))
  }, [])

  if (!data || dismissed || data.completed) return null

  const next = data.steps.find((step) => !step.done)
  const progress = Math.round((data.completedCount / data.totalSteps) * 100)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.shareUrl)
      toast.success('Link copiado.')
    } catch {
      toast.error('Selecione o link e copie manualmente.')
    }
  }

  const finish = async () => {
    setBusy(true)
    try {
      await repository.completeOnboarding()
      setDismissed(true)
      toast.success('Configuração concluída.')
    } catch (caught) {
      toast.error(errorMessage(caught, 'Não foi possível concluir'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-brand/40 bg-tint">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-serif text-xl"><Rocket aria-hidden="true" className="size-5 text-brand-deep" /> Primeiros passos</p>
        <span className="text-xs font-bold text-muted">{data.completedCount}/{data.totalSteps} concluídos</span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-paper-deep" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da configuração">
        <span className="block h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
      </div>
      {next ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-56 flex-1">
            <strong className="block text-sm">{next.title}</strong>
            <p className="text-xs text-muted">{next.description}</p>
          </div>
          <Button size="sm" variant="dark" onClick={() => navigate(sectionByAction[next.action] ?? '/barbeiro/ajustes')}>
            Resolver <ArrowRight aria-hidden="true" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void copy()}><Clipboard aria-hidden="true" /> Copiar link</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-2 text-sm"><Check aria-hidden="true" className="size-4 text-success-ink" /> Tudo pronto para receber agendamentos.</p>
          <Button size="sm" loading={busy} onClick={finish}>Concluir configuração</Button>
        </div>
      )}
    </Card>
  )
}
