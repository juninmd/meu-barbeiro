import { Clock3, Scissors, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { errorMessage, repository } from '../lib/repository'
import type { WalkInQueueEntry } from '../types'
import { Button } from './ui/Button'
import { CountBadge, EmptyState } from './ui/EmptyState'
import { Eyebrow, Notice } from './ui/Notice'
import { cardStyles } from './ui/Card'
import { cn } from '../lib/cn'

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
    <section className={cn(cardStyles, 'grid gap-4')} aria-labelledby="walk-in-queue-title">
      <div className="flex items-start justify-between gap-4">
        <div><Eyebrow>{canCall ? 'Quem está na porta' : 'Sua vez'}</Eyebrow><h2 id="walk-in-queue-title" className="font-serif text-xl font-medium">Fila de chegada</h2></div>
        <CountBadge>{waiting.length}</CountBadge>
      </div>
      <p className="text-xs font-bold text-muted">A ordem é por chegada, mas clientes com horário marcado têm prioridade.</p>
      {error && <Notice tone="danger" role="alert">{error}</Notice>}
      {waiting.length === 0 && <EmptyState><UserRound aria-hidden="true" /><strong>Ninguém aguardando</strong><p>A fila atualiza automaticamente.</p></EmptyState>}
      <ul className="grid gap-3">
        {waiting.map((entry) => (
          <li className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]" key={entry.id}>
            <span className="grid size-11 place-items-center rounded-full border border-brand/50 bg-tint font-serif font-medium text-brand-deep tabular-nums">{entry.position ?? '—'}º</span>
            <div className="grid gap-0.5 text-sm text-muted [&_svg]:size-3.5 [&_svg]:shrink-0">
              <strong className="text-base text-ink">{entry.name}</strong>
              <p className="flex items-center gap-1.5"><Scissors aria-hidden="true" /> {entry.services.map((service) => service.name).join(' + ')}</p>
              <small className="flex items-center gap-1.5 text-xs"><Clock3 aria-hidden="true" /> {entry.estimatedMinutes == null ? 'Sem encaixe hoje' : entry.estimatedMinutes === 0 ? 'Pode chamar agora' : `${entry.estimatedMinutes} min de espera`} {entry.assignedBarber ? `· ${entry.assignedBarber.name}` : ''}</small>
            </div>
            <div className="col-span-full flex flex-wrap gap-2 sm:col-span-1">
              {canCall && <Button size="sm" disabled={busyId === entry.id || entry.estimatedMinutes !== 0 || Boolean(callerBarberId && entry.assignedBarber?.id !== callerBarberId)} onClick={() => void call(entry)}>Chamar</Button>}
              <Button variant="ghost" size="sm" disabled={busyId === entry.id} onClick={() => void giveUp(entry)}><X aria-hidden="true" /> Desistiu</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
