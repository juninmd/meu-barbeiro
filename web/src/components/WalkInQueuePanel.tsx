import { Clock3, Scissors, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { errorMessage, repository } from '../lib/repository'
import type { WalkInQueueEntry } from '../types'

interface WalkInQueuePanelProps {
  canCall?: boolean
  onCalled?: () => Promise<void>
  refreshKey?: number
  hideWhenEmpty?: boolean
  callerBarberId?: string
}

export function WalkInQueuePanel({ canCall = false, onCalled, refreshKey = 0, hideWhenEmpty = false, callerBarberId }: WalkInQueuePanelProps) {
  const [entries, setEntries] = useState<WalkInQueueEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setEntries(await repository.walkInQueue())
      setError(null)
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível atualizar a fila'))
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = window.setInterval(() => void load(), 15_000)
    return () => window.clearInterval(interval)
  }, [load, refreshKey])

  const call = async (entry: WalkInQueueEntry) => {
    setBusyId(entry.id)
    try {
      await repository.callWalkInQueue(entry.id, entry.assignedBarber?.id)
      await load()
      await onCalled?.()
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível chamar'))
    } finally {
      setBusyId(null)
    }
  }

  const giveUp = async (entry: WalkInQueueEntry) => {
    setBusyId(entry.id)
    try {
      await repository.giveUpWalkInQueue(entry.id)
      await load()
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível registrar a desistência'))
    } finally {
      setBusyId(null)
    }
  }

  const waiting = entries.filter((entry) => entry.status === 'WAITING')
  if (hideWhenEmpty && waiting.length === 0 && !error) return null
  return (
    <section className="panel walk-in-queue-panel" aria-labelledby="walk-in-queue-title">
      <div className="section-heading compact">
        <div><p className="eyebrow">{canCall ? 'Quem está na porta' : 'Sua vez'}</p><h2 id="walk-in-queue-title">Fila de chegada</h2></div>
        <span className="count-badge">{waiting.length}</span>
      </div>
      <p className="priority-note">A ordem é por chegada, mas clientes com horário marcado têm prioridade.</p>
      {error && <p className="form-message" role="alert">{error}</p>}
      {waiting.length === 0 && <div className="empty-state"><UserRound aria-hidden="true" /><strong>Ninguém aguardando</strong><p>A fila atualiza automaticamente.</p></div>}
      <div className="walk-in-queue-list">
        {waiting.map((entry) => (
          <article className="walk-in-queue-item" key={entry.id}>
            <span className="queue-position">{entry.position ?? '—'}º</span>
            <div>
              <strong>{entry.name}</strong>
              <p><Scissors aria-hidden="true" /> {entry.services.map((service) => service.name).join(' + ')}</p>
              <small><Clock3 aria-hidden="true" /> {entry.estimatedMinutes == null ? 'Sem encaixe hoje' : entry.estimatedMinutes === 0 ? 'Pode chamar agora' : `${entry.estimatedMinutes} min de espera`} {entry.assignedBarber ? `· ${entry.assignedBarber.name}` : ''}</small>
            </div>
            <div className="action-row">
              {canCall && <button className="button button-small button-primary" type="button" disabled={busyId === entry.id || entry.estimatedMinutes !== 0 || Boolean(callerBarberId && entry.assignedBarber?.id !== callerBarberId)} onClick={() => void call(entry)}>Chamar</button>}
              <button className="button button-small button-ghost" type="button" disabled={busyId === entry.id} onClick={() => void giveUp(entry)}><X aria-hidden="true" /> Desistiu</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
