import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { formatCurrency } from '../lib/format'
import { errorMessage, repository } from '../lib/repository'
import type { CustomerPackage, ServicePackage } from '../types'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { inputStyles } from './ui/Field'
import { PackageMeter } from './ui/PackageMeter'

const statusTone = { ACTIVE: 'success', EXHAUSTED: 'neutral', EXPIRED: 'danger' } as const
const statusLabel = { ACTIVE: 'Ativo', EXHAUSTED: 'Esgotado', EXPIRED: 'Expirado' } as const
const dateLabel = (value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))

/** Visão do cliente: saldo dos pacotes comprados. */
export function MyPackages() {
  const [items, setItems] = useState<CustomerPackage[] | null>(null)
  useEffect(() => {
    let active = true
    repository.myPackages().then((value) => active && setItems(value)).catch(() => active && setItems([]))
    return () => { active = false }
  }, [])
  if (!items || items.length === 0) return null
  return (
    <section className="grid gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm" aria-labelledby="my-packages-title">
      <h3 id="my-packages-title" className="font-serif text-xl font-medium">Meus pacotes</h3>
      <ul className="grid gap-4">
        {items.map((item) => (
          <li key={item.id} className="grid gap-2 border-t border-line pt-3 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.name}</strong><Badge tone={statusTone[item.status]}>{statusLabel[item.status]}</Badge></div>
            <PackageMeter used={item.sessionsUsed} total={item.sessionsTotal} />
            <small className="text-muted">{item.serviceName ?? 'Qualquer serviço'} · válido até {dateLabel(item.expiresAt)}</small>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Visão da equipe na ficha do cliente: saldo, baixa de sessão e venda de pacote. */
export function CustomerPackagesAdmin({ userId }: { userId: string }) {
  const [items, setItems] = useState<CustomerPackage[]>([])
  const [catalog, setCatalog] = useState<ServicePackage[]>([])
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [mine, available] = await Promise.all([repository.customerPackages(userId), repository.packages()])
    setItems(mine)
    setCatalog(available.filter((item) => item.active))
  }, [userId])
  useEffect(() => { void load().catch(() => undefined) }, [load])

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key)
    try { await action(); toast.success(success); await load() } catch (caught) { toast.error(errorMessage(caught, 'Não foi possível concluir.')) } finally { setBusy(null) }
  }

  return (
    <section className="grid gap-3 rounded-2xl border border-line bg-surface p-4" aria-label="Pacotes do cliente">
      <h4 className="font-serif text-lg font-medium">Pacotes</h4>
      {items.length === 0 && <p className="text-sm text-muted">Este cliente não tem pacotes.</p>}
      <ul className="grid gap-3">
        {items.map((item) => (
          <li key={item.id} className="grid gap-2 rounded-xl bg-surface-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.name}</strong><Badge tone={statusTone[item.status]}>{statusLabel[item.status]}</Badge></div>
            <PackageMeter used={item.sessionsUsed} total={item.sessionsTotal} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <small className="text-muted">válido até {dateLabel(item.expiresAt)}</small>
              {item.status === 'ACTIVE' && <Button size="sm" variant="dark" loading={busy === item.id} onClick={() => void run(item.id, () => repository.redeemPackage(item.id), 'Sessão descontada do pacote.')}>Registrar uso</Button>}
            </div>
          </li>
        ))}
      </ul>
      {catalog.length > 0 && (
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="grid min-w-48 flex-1 gap-1 text-xs font-bold text-muted">Vender pacote
            <select className={inputStyles('text-sm')} value={selected} onChange={(event) => setSelected(event.target.value)}>
              <option value="">Escolha um pacote</option>
              {catalog.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatCurrency(item.price)}</option>)}
            </select>
          </label>
          <Button size="sm" disabled={!selected} loading={busy === 'sell'} onClick={() => void run('sell', () => repository.sellPackage(selected, userId), 'Pacote vendido ao cliente.').then(() => setSelected(''))}>Vender</Button>
        </div>
      )}
    </section>
  )
}
