import { PackageOpen, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, inputStyles } from '../../components/ui/Field'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { Service, ServicePackage } from '../../types'

/** Catálogo de pacotes pré-pagos (N sessões por um preço fechado, com validade). */
export function PackagesPanel({ services }: { services: Service[] }) {
  const [packages, setPackages] = useState<ServicePackage[]>([])
  const [name, setName] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [sessions, setSessions] = useState('5')
  const [price, setPrice] = useState('')
  const [validity, setValidity] = useState('90')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => repository.packages().then(setPackages).catch((caught) => toast.error(errorMessage(caught, 'Não foi possível carregar os pacotes.'))), [])
  useEffect(() => { void load() }, [load])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await repository.createPackage({ name: name.trim(), serviceId: serviceId || null, sessions: Number(sessions), price: Number(price), validityDays: Number(validity) })
      toast.success('Pacote criado.')
      setName(''); setPrice('')
      await load()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Não foi possível criar o pacote.'))
    } finally {
      setBusy(false)
    }
  }

  const deactivate = async (item: ServicePackage) => {
    try {
      await repository.deactivatePackage(item.id)
      toast.success(`"${item.name}" desativado. Pacotes já vendidos continuam valendo.`)
      await load()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Não foi possível desativar.'))
    }
  }

  const perSession = Number(sessions) > 0 && Number(price) > 0 ? Number(price) / Number(sessions) : null

  return (
    <Card as="section" aria-labelledby="packages-title" className="grid gap-6">
      <div>
        <p className="mb-1 flex items-center gap-2 text-[.72rem] font-extrabold tracking-[.18em] text-brand-deep uppercase"><PackageOpen className="size-4" aria-hidden="true" /> Pacotes pré-pagos</p>
        <h2 id="packages-title" className="font-serif text-2xl font-medium tracking-tight">Pacotes de sessões</h2>
        <p className="mt-1 text-muted">Ex.: 5 cortes por um preço fechado. Venda para o cliente no balcão e dê baixa a cada atendimento na ficha dele (aba Clientes).</p>
      </div>

      <form onSubmit={submit} className="grid gap-4 rounded-2xl bg-surface-2 p-4 sm:grid-cols-2" aria-label="Novo pacote">
        <Field label="Nome do pacote" className="sm:col-span-2"><Input required minLength={3} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Pacote 5 cortes" /></Field>
        <Field label="Serviço coberto">
          <select className={inputStyles()} value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
            <option value="">Qualquer serviço</option>
            {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>
        </Field>
        <Field label="Sessões"><Input type="number" inputMode="numeric" min={2} max={50} required value={sessions} onChange={(event) => setSessions(event.target.value)} /></Field>
        <Field label="Preço do pacote (R$)" hint={perSession ? `${formatCurrency(perSession)} por sessão` : undefined}><Input type="number" inputMode="decimal" min={1} step="0.01" required value={price} onChange={(event) => setPrice(event.target.value)} /></Field>
        <Field label="Validade (dias)"><Input type="number" inputMode="numeric" min={7} max={730} required value={validity} onChange={(event) => setValidity(event.target.value)} /></Field>
        <Button type="submit" loading={busy} className="w-fit max-sm:w-full sm:col-span-2"><Plus aria-hidden="true" /> Criar pacote</Button>
      </form>

      {packages.length === 0 ? <p className="text-muted">Nenhum pacote ainda.</p> : (
        <ul className="grid gap-3">
          {packages.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line p-4">
              <div className="min-w-0">
                <strong className="flex flex-wrap items-center gap-2">{item.name} {!item.active && <Badge>Desativado</Badge>}</strong>
                <span className="text-sm text-muted">{item.sessions} sessões · {item.serviceName ?? 'qualquer serviço'} · validade {item.validityDays} dias</span>
              </div>
              <div className="flex items-center gap-3">
                <strong className="font-serif text-xl tabular-nums">{formatCurrency(item.price)}</strong>
                {item.active && <Button variant="ghost" size="sm" onClick={() => void deactivate(item)} aria-label={`Desativar ${item.name}`}><Trash2 aria-hidden="true" /></Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
