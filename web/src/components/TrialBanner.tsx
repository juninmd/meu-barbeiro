import { ArrowRight, CircleAlert, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Barbershop } from '../types'

/** Aviso de teste/assinatura no topo do painel. Só aparece quando há algo a resolver. */
export function TrialBanner({ barbershop }: { barbershop: Barbershop | null }) {
  const subscription = barbershop?.subscription
  if (!subscription) return null

  if (subscription.isBlocked) {
    return (
      <div className="flex flex-wrap items-center gap-3 bg-danger-solid px-4 py-2.5 text-sm text-white" role="alert">
        <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
        <p className="min-w-56 flex-1">
          <strong>Modo leitura.</strong>{' '}
          {subscription.state === 'CANCELED'
            ? 'Sua assinatura foi cancelada. Reative para editar serviços e equipe.'
            : 'Seu teste grátis terminou. Escolha um plano para editar serviços e equipe.'}
        </p>
        <Link className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-black text-danger-ink" to="/barbeiro/assinatura">
          Escolher plano <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    )
  }

  if (subscription.state === 'TRIALING' && subscription.trialDaysLeft <= 7) {
    return (
      <div className="flex flex-wrap items-center gap-3 bg-[#f3d899] px-4 py-2.5 text-sm text-[#5f4517]" role="status">
        <Sparkles aria-hidden="true" className="size-4 shrink-0" />
        <p className="min-w-56 flex-1">
          <strong>{subscription.trialDaysLeft} dia{subscription.trialDaysLeft === 1 ? '' : 's'} de teste.</strong>{' '}
          Assine para não perder a edição da barbearia.
        </p>
        <Link className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-black text-paper" to="/barbeiro/assinatura">
          Ver planos <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    )
  }

  return null
}
