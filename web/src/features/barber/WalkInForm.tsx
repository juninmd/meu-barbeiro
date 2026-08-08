import { Clock3, Plus, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CustomerProfileCard } from '../../components/CustomerProfileCard'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { Barber, Barbershop, CustomerSummary, FitNowResponse, Service, User } from '../../types'

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
    return <button className="button button-primary" type="button" onClick={() => setOpen(true)}><Plus aria-hidden="true" /> Quem chegou agora?</button>
  }

  return (
    <section className="panel walk-in-panel" aria-labelledby="walk-in-title">
      <div className="section-heading compact">
        <div><p className="eyebrow">Atendimento pelo balcão</p><h2 id="walk-in-title">Entrada sem horário</h2></div>
        <button className="button button-ghost button-small" type="button" onClick={() => setOpen(false)}>Fechar</button>
      </div>
      {message && <p className="form-message" role="alert">{message}</p>}
      <form className="booking-form" onSubmit={submit}>
        <fieldset>
          <legend><span>01</span> Cliente</legend>
          <div className="action-row">
            <button className={`button button-small ${existing ? 'button-dark' : 'button-ghost'}`} type="button" onClick={() => setExisting(true)}>Cliente existente</button>
            <button className={`button button-small ${existing ? 'button-ghost' : 'button-dark'}`} type="button" onClick={() => setExisting(false)}>Visitante</button>
          </div>
          {existing ? (
            <>
              <label>Buscar por nome ou telefone<input value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              <div className="customer-results">
                {customers.map((customer) => (
                  <label className={`customer-option ${customerId === customer.id ? 'selected' : ''}`} key={customer.id}>
                    <input type="radio" name="customer" value={customer.id} checked={customerId === customer.id} onChange={() => setCustomerId(customer.id)} required />
                    <UserRound aria-hidden="true" />
                    <span><strong>{customer.name}</strong><small>{customer.phone || 'Sem telefone'}{customer.noShowCount > 0 ? ` · ${customer.noShowCount} falta(s)` : ''}</small></span>
                  </label>
                ))}
              </div>
              {selectedCustomer && <CustomerProfileCard userId={selectedCustomer.id} />}
            </>
          ) : <label>Nome do visitante<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} /></label>}
        </fieldset>
        <fieldset>
          <legend><span>02</span> O que será feito?</legend>
          <div className="choice-grid choice-grid-small">
            {services.map((service) => (
              <label className={`choice-card ${serviceIds.includes(service.id) ? 'selected' : ''}`} key={service.id}>
                <input type="checkbox" checked={serviceIds.includes(service.id)} onChange={() => toggleService(service.id)} />
                <span><strong>{service.name}</strong><small>{service.duration} min · {formatCurrency(service.price)}</small></span>
              </label>
            ))}
          </div>
          <label>Preferência de barbeiro<select value={barberId} onChange={(event) => setBarberId(event.target.value)} disabled={barberLocked}><option value="">Primeira cadeira livre</option>{barbers.map((barber) => <option value={barber.id} key={barber.id}>{barber.name}</option>)}</select></label>
        </fieldset>
        <fieldset>
          <legend><span>03</span> Cabe agora?</legend>
          {checkingFit && <p className="availability-status" role="status">Conferindo agenda, almoço e ausências…</p>}
          {!checkingFit && serviceIds.length === 0 && <p className="empty-copy">Selecione ao menos um serviço.</p>}
          <div className="fit-now-grid">
            {fit?.barbers.map((item) => (
              <article className={`fit-now-card ${item.fitsNow ? 'available' : ''}`} key={item.barber.id}>
                <strong>{item.barber.name}</strong>
                <span>{item.fitsNow ? 'Cabe agora' : item.nextAvailableAt ? `Próximo: ${timeLabel(item.nextAvailableAt, fit.timezone)}` : 'Sem encaixe hoje'}</span>
                {item.currentServiceMinutesLeft > 0 && <small><Clock3 aria-hidden="true" /> libera em {item.currentServiceMinutesLeft} min</small>}
              </article>
            ))}
          </div>
          <p className="priority-note">Horários marcados têm prioridade. A estimativa será recalculada conforme a agenda e a fila avançam.</p>
        </fieldset>
        <button className="button button-primary button-wide" disabled={busy || serviceIds.length === 0 || (existing ? !customerId : name.trim().length < 2)}>{busy ? 'Registrando…' : 'Adicionar à fila'} <Clock3 aria-hidden="true" /></button>
      </form>
    </section>
  )
}
