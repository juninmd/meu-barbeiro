import { Gift, Stamp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { errorMessage, repository } from '../lib/repository'
import type { LoyaltyCard } from '../types'

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

  if (!card) return <p className="form-message" role="status">{message || 'Carregando cartão fidelidade…'}</p>
  if (!card.program?.enabled) return <p className="loyalty-disabled">O programa de fidelidade não está ativo nesta barbearia.</p>
  const program = card.program

  return (
    <>
      <section className="loyalty-card" aria-label="Cartão fidelidade">
        <div className="loyalty-heading">
          <div><p className="eyebrow"><Stamp aria-hidden="true" /> Cartão fidelidade</p><h3>{program.rewardDescription}</h3></div>
          <strong>{card.availableStamps}<small>/{program.requiredVisits}</small></strong>
        </div>
        <div className="stamp-row" aria-label={`${card.availableStamps} selos disponíveis de ${program.requiredVisits}`}>
          {Array.from({ length: program.requiredVisits }, (_, index) => (
            <span className={index < Math.min(card.availableStamps, program.requiredVisits) ? 'filled' : ''} key={index}><Stamp aria-hidden="true" /></span>
          ))}
        </div>
        {card.availableRewards > 0
          ? <p className="reward-ready"><Gift aria-hidden="true" /> Prêmio disponível para resgate.</p>
          : <p>Faltam <strong>{card.remainingToReward}</strong> visita(s) concluída(s) para o próximo prêmio.</p>}
        {message && <p className="form-message" role="status">{message}</p>}
        {canRedeem && card.availableRewards > 0 && (
          <button className="button button-primary" type="button" onClick={() => setConfirming(true)}>Resgatar prêmio</button>
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
