import { CalendarDays, Plus, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AppointmentSlots } from '../../components/AppointmentSlots'
import { CustomerProfileCard } from '../../components/CustomerProfileCard'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { AppointmentAvailability, Barber, Barbershop, CustomerSummary, Service, User } from '../../types'

interface WalkInFormProps {
  barbers: Barber[]
  barbershop: Barbershop
  currentUser: User
  services: Service[]
  onCreated: () => Promise<void>
}

const todayInTimezone = (timezone: string) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function WalkInForm({ barbers, barbershop, currentUser, services, onCreated }: WalkInFormProps) {
  const barberLocked = barbershop.membershipRole === 'BARBER'
  const [open, setOpen] = useState(false)
  const [existing, setExisting] = useState(true)
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [customerId, setCustomerId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [barberId, setBarberId] = useState(barberLocked ? currentUser.id : '')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [availability, setAvailability] = useState<AppointmentAvailability | null>(null)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [loadingAvailability, setLoadingAvailability] = useState(false)
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
    setAvailability(null)
    setAvailabilityError(null)
    setScheduledAt('')
    if (!barberId || !serviceId || !date) return
    let active = true
    setLoadingAvailability(true)
    repository.availability(barberId, serviceId, date)
      .then((result) => { if (active) setAvailability(result) })
      .catch((error) => { if (active) setAvailabilityError(errorMessage(error, 'Não foi possível consultar os horários')) })
      .finally(() => { if (active) setLoadingAvailability(false) })
    return () => { active = false }
  }, [barberId, date, serviceId])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await repository.createWalkIn({
        barberId,
        serviceId,
        scheduledAt,
        ...(existing ? { userId: customerId } : { customer: { name, ...(phone ? { phone } : {}) } }),
      })
      await onCreated()
      setOpen(false)
      setMessage(null)
      setCustomerId('')
      setName('')
      setPhone('')
      setServiceId('')
      setDate('')
      setScheduledAt('')
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível lançar o atendimento'))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return <button className="button button-primary" type="button" onClick={() => setOpen(true)}><Plus aria-hidden="true" /> Novo atendimento</button>
  }

  return (
    <section className="panel walk-in-panel" aria-labelledby="walk-in-title">
      <div className="section-heading compact">
        <div><p className="eyebrow">Atendimento pelo balcão</p><h2 id="walk-in-title">Novo atendimento</h2></div>
        <button className="button button-ghost button-small" type="button" onClick={() => setOpen(false)}>Fechar</button>
      </div>
      {message && <p className="form-message" role="alert">{message}</p>}
      <form className="booking-form" onSubmit={submit}>
        <fieldset>
          <legend><span>01</span> Cliente</legend>
          <div className="action-row">
            <button className={`button button-small ${existing ? 'button-dark' : 'button-ghost'}`} type="button" onClick={() => setExisting(true)}>Cliente existente</button>
            <button className={`button button-small ${existing ? 'button-ghost' : 'button-dark'}`} type="button" onClick={() => setExisting(false)}>Cadastrar na hora</button>
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
              {selectedCustomer && selectedCustomer.noShowCount > 0 && <p className="form-message warning" role="status">Atenção: este cliente já teve {selectedCustomer.noShowCount} falta(s) nesta barbearia.</p>}
              {selectedCustomer && <CustomerProfileCard userId={selectedCustomer.id} />}
            </>
          ) : (
            <div className="form-row">
              <label>Nome<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} /></label>
              <label>Telefone (opcional)<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" /></label>
            </div>
          )}
        </fieldset>
        <fieldset>
          <legend><span>02</span> Atendimento</legend>
          <div className="form-row">
            <label>Serviço<select value={serviceId} onChange={(event) => setServiceId(event.target.value)} required><option value="">Selecione</option>{services.map((service) => <option value={service.id} key={service.id}>{service.name} · {formatCurrency(service.price)}</option>)}</select></label>
            <label>Barbeiro<select value={barberId} onChange={(event) => setBarberId(event.target.value)} required disabled={barberLocked}><option value="">Selecione</option>{barbers.map((barber) => <option value={barber.id} key={barber.id}>{barber.name}</option>)}</select></label>
          </div>
        </fieldset>
        <fieldset>
          <legend><span>03</span> Horário livre</legend>
          <label className="date-field"><CalendarDays aria-hidden="true" /><span><strong>Data</strong><small>Agenda da barbearia</small></span><input aria-label="Data do atendimento" type="date" value={date} min={todayInTimezone(barbershop.timezone)} onChange={(event) => setDate(event.target.value)} required /></label>
          <AppointmentSlots availability={availability} error={availabilityError} loading={loadingAvailability} selected={scheduledAt} browserTimezone={Intl.DateTimeFormat().resolvedOptions().timeZone} onSelect={setScheduledAt} />
        </fieldset>
        <button className="button button-primary button-wide" disabled={busy || !scheduledAt || (existing ? !customerId : !name.trim())}>{busy ? 'Lançando…' : 'Confirmar atendimento'} <CalendarDays aria-hidden="true" /></button>
      </form>
    </section>
  )
}
