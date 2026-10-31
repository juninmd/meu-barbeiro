import { Gift, Stamp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { errorMessage, repository } from '../lib/repository'
import type { LoyaltyCard } from '../types'
import { Button } from './ui/Button'
import { Notice } from './ui/Notice'
import { cn } from '../lib/cn'

interface LoyaltyCardPanelProps {
  userId?: string
  canRedeem?: boolean
}

export function LoyaltyCardPanel({ userId, canRedeem = false }: LoyaltyCardPanelProps) {
  const [card, setCard] = useState<LoyaltyCard | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    setCard(null)
    setMessage(null)
    const request = userId ? repository.loyaltyCard(userId) : repository.loyaltyMe()
    request.then((result) => { if (active) setCard(result) })
      .catch((error) => { if (active) setMessage(errorMessage(error, 'Não foi possível carregar o cartão fidelidade')) })
    return () => { active = false }
  }, [userId])

  const redeem = async () => {
    if (!userId) return
    setBusy(true)
    setMessage(null)
    try {
      setCard(await repository.redeemLoyalty(userId))
      setConfirming(false)
      setMessage('Prêmio resgatado. Os selos usados foram baixados do cartão.')
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível resgatar o prêmio'))
    } finally {
      setBusy(false)
    }
  }

  if (!card) return <Notice role="status">{message || 'Carregando cartão fidelidade…'}</Notice>
  if (!card.program?.enabled) return <p className="rounded-xl bg-surface-3 p-3 text-xs text-muted">O programa de fidelidade não está ativo nesta barbearia.</p>
  const program = card.program
  const filled = Math.min(card.availableStamps, program.requiredVisits)

  return (
    <>
      <section className="grid gap-3.5 rounded-2xl bg-chrome p-5 text-chrome-ink shadow-sm" aria-label="Cartão fidelidade">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 flex items-center gap-2 text-[.72rem] font-extrabold tracking-[.18em] text-brand-light uppercase [&_svg]:size-4"><Stamp aria-hidden="true" /> Cartão fidelidade</p>
            <h3 className="font-serif text-xl font-medium text-white">{program.rewardDescription}</h3>
          </div>
          <strong className="font-serif text-3xl font-medium text-brand tabular-nums">{card.availableStamps}<small className="text-sm text-chrome-ink/60">/{program.requiredVisits}</small></strong>
        </div>
        <div className="flex flex-wrap gap-1.5" role="img" aria-label={`${card.availableStamps} selos disponíveis de ${program.requiredVisits}`}>
          {Array.from({ length: program.requiredVisits }, (_, index) => (
            <span className={cn('grid size-8 place-items-center rounded-full border [&_svg]:size-4', index < filled ? 'border-brand bg-brand text-chrome' : 'border-dashed border-chrome-ink/40 text-chrome-ink/50')} key={index}><Stamp aria-hidden="true" /></span>
          ))}
        </div>
        {card.availableRewards > 0
          ? <p className="flex items-center gap-2 font-extrabold text-brand-light [&_svg]:size-[1.15rem]"><Gift aria-hidden="true" /> Prêmio disponível para resgate.</p>
          : <p className="text-xs text-chrome-ink/80">Faltam <strong className="text-white">{card.remainingToReward}</strong> visita(s) concluída(s) para o próximo prêmio.</p>}
        {message && <Notice role="status">{message}</Notice>}
        {canRedeem && card.availableRewards > 0 && (
          <Button className="justify-self-start" onClick={() => setConfirming(true)}>Resgatar prêmio</Button>
        )}
      </section>
      {confirming && (
        <ConfirmDialog
          eyebrow="Confirmar resgate"
          title="Entregar o prêmio agora?"
          description={`${program.rewardDescription}. Serão usados ${program.requiredVisits} selos do cliente.`}
          cancelLabel="Voltar"
          confirmLabel={busy ? 'Resgatando…' : 'Sim, resgatar'}
          busy={busy}
          error={message}
          onCancel={() => { setConfirming(false); setMessage(null) }}
          onConfirm={() => void redeem()}
        />
      )}
    </>
  )
}
