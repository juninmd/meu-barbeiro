import { Clock3, Plus, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CustomerProfileCard } from '../../components/CustomerProfileCard'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { Barber, Barbershop, CustomerSummary, FitNowResponse, Service, User } from '../../types'
import { Button } from '../../components/ui/Button'
import { ChoiceCard, StepFieldset } from '../../components/ui/Choice'
import { Field, Input, Select } from '../../components/ui/Field'
import { Notice, SectionHeading } from '../../components/ui/Notice'
import { cardStyles } from '../../components/ui/Card'
import { cn } from '../../lib/cn'

interface WalkInFormProps {
  barbers: Barber[]
  barbershop: Barbershop
  currentUser: User
  services: Service[]
  onCreated: () => Promise<void>
}

const timeLabel = (value: string, timezone: string) => new Intl.DateTimeFormat('pt-BR', {
  timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date(value))

export function WalkInForm({ barbers, barbershop, currentUser, services, onCreated }: WalkInFormProps) {
  const barberLocked = barbershop.membershipRole === 'BARBER'
  const [open, setOpen] = useState(false)
  const [existing, setExisting] = useState(true)
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [customerId, setCustomerId] = useState('')
  const [name, setName] = useState('')
  const [barberId, setBarberId] = useState(barberLocked ? currentUser.id : '')
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [fit, setFit] = useState<FitNowResponse | null>(null)
  const [checkingFit, setCheckingFit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const selectedCustomer = customers.find((customer) => customer.id === customerId)

  useEffect(() => {
    if (!open || !existing) return
    let active = true
    repository.customers(query).then((result) => { if (active) setCustomers(result) })
      .catch((error) => { if (active) setMessage(errorMessage(error, 'Não foi possível buscar clientes')) })
    return () => { active = false }
  }, [existing, open, query])

  useEffect(() => {
    setFit(null)
    if (!open || serviceIds.length === 0) return
    let active = true
    setCheckingFit(true)
    repository.fitNow(serviceIds, barberId || undefined)
      .then((result) => { if (active) setFit(result) })
      .catch((error) => { if (active) setMessage(errorMessage(error, 'Não foi possível calcular o encaixe')) })
      .finally(() => { if (active) setCheckingFit(false) })
    return () => { active = false }
  }, [barberId, open, serviceIds])

  const toggleService = (serviceId: string) => setServiceIds((current) => (
    current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId]
  ))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const entry = await repository.joinWalkInQueue({
        serviceIds,
        barberId: barberId || null,
        ...(existing ? { userId: customerId } : { guestName: name.trim() }),
      })
      await onCreated()
      setOpen(false)
      setCustomerId('')
      setName('')
      setServiceIds([])
      setMessage(entry.estimatedMinutes == null
        ? 'Entrada registrada, mas não há encaixe disponível hoje.'
        : `Entrada registrada. Espera estimada: ${entry.estimatedMinutes} min.`)
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível registrar na fila'))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}><Plus aria-hidden="true" /> Quem chegou agora?</Button>
  }

  return (
    <section className={cn(cardStyles, 'grid gap-5')} aria-labelledby="walk-in-title">
      <SectionHeading eyebrow="Atendimento pelo balcão" title="Entrada sem horário" id="walk-in-title" aside={<Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Fechar</Button>} />
      {message && <Notice tone="danger" role="alert">{message}</Notice>}
      <form className="grid gap-8" onSubmit={submit}>
        <StepFieldset step="01" title="Cliente">
          <div className="flex flex-wrap gap-2">
            <Button variant={existing ? 'dark' : 'ghost'} size="sm" onClick={() => setExisting(true)}>Cliente existente</Button>
            <Button variant={existing ? 'ghost' : 'dark'} size="sm" onClick={() => setExisting(false)}>Visitante</Button>
          </div>
          {existing ? (
            <>
              <Field label="Buscar por nome ou telefone"><Input value={query} onChange={(event) => setQuery(event.target.value)} /></Field>
              <div className="grid gap-2">
                {customers.map((customer) => (
                  <label className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand/35', customerId === customer.id ? 'border-brand bg-tint ring-2 ring-brand' : 'border-line bg-surface-2 hover:border-brand-deep/60')} key={customer.id}>
                    <input className="sr-only" type="radio" name="customer" value={customer.id} checked={customerId === customer.id} onChange={() => setCustomerId(customer.id)} required />
                    <UserRound className="size-5 shrink-0 text-brand-deep" aria-hidden="true" />
                    <span className="grid gap-0.5"><strong>{customer.name}</strong><small className="text-xs text-muted">{customer.phone || 'Sem telefone'}{customer.noShowCount > 0 ? ` · ${customer.noShowCount} falta(s)` : ''}</small></span>
                  </label>
                ))}
              </div>
              {selectedCustomer && <CustomerProfileCard userId={selectedCustomer.id} />}
            </>
          ) : <Field label="Nome do visitante"><Input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} /></Field>}
        </StepFieldset>
        <StepFieldset step="02" title="O que será feito?">
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((service) => (
              <ChoiceCard key={service.id} type="checkbox" checked={serviceIds.includes(service.id)} onChange={() => toggleService(service.id)} title={service.name} hint={`${service.duration} min · ${formatCurrency(service.price)}`} />
            ))}
          </div>
          <Field label="Preferência de barbeiro"><Select value={barberId} onChange={(event) => setBarberId(event.target.value)} disabled={barberLocked}><option value="">Primeira cadeira livre</option>{barbers.map((barber) => <option value={barber.id} key={barber.id}>{barber.name}</option>)}</Select></Field>
        </StepFieldset>
        <StepFieldset step="03" title="Cabe agora?">
          {checkingFit && <p className="text-xs text-muted" role="status">Conferindo agenda, almoço e ausências…</p>}
          {!checkingFit && serviceIds.length === 0 && <p className="text-sm text-muted">Selecione ao menos um serviço.</p>}
          <div className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
            {fit?.barbers.map((item) => (
              <article className={cn('grid gap-1 rounded-xl border p-4 text-sm text-muted', item.fitsNow ? 'border-ok bg-success-soft text-success-ink' : 'border-line bg-surface-2')} key={item.barber.id}>
                <strong className="text-base text-ink">{item.barber.name}</strong>
                <span>{item.fitsNow ? 'Cabe agora' : item.nextAvailableAt ? `Próximo: ${timeLabel(item.nextAvailableAt, fit.timezone)}` : 'Sem encaixe hoje'}</span>
                {item.currentServiceMinutesLeft > 0 && <small className="flex items-center gap-1.5 text-xs"><Clock3 className="size-3.5" aria-hidden="true" /> libera em {item.currentServiceMinutesLeft} min</small>}
              </article>
            ))}
          </div>
          <p className="text-xs font-bold text-muted">Horários marcados têm prioridade. A estimativa será recalculada conforme a agenda e a fila avançam.</p>
        </StepFieldset>
        <Button type="submit" block loading={busy} disabled={serviceIds.length === 0 || (existing ? !customerId : name.trim().length < 2)}>{busy ? 'Registrando…' : 'Adicionar à fila'} <Clock3 aria-hidden="true" /></Button>
      </form>
    </section>
  )
}
