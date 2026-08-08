import { useEffect, useState } from 'react'
import { formatCurrency, formatDate } from '../lib/format'
import { errorMessage, repository } from '../lib/repository'
import type { CustomerProfileFields, CustomerProfileResponse } from '../types'
import { LoyaltyCardPanel } from './LoyaltyCardPanel'

interface CustomerProfileCardProps {
  userId: string
}

const emptyProfile: CustomerProfileFields = { preferences: null, notes: null, allergies: null }

export function CustomerProfileCard({ userId }: CustomerProfileCardProps) {
  const [data, setData] = useState<CustomerProfileResponse | null>(null)
  const [form, setForm] = useState<CustomerProfileFields>(emptyProfile)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    setData(null)
    setMessage(null)
    repository.customerProfile(userId)
      .then((result) => {
        if (!active) return
        setData(result)
        setForm(result.profile ?? emptyProfile)
      })
      .catch((error) => { if (active) setMessage(errorMessage(error, 'Não foi possível abrir a ficha')) })
    return () => { active = false }
  }, [userId])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const result = await repository.saveCustomerProfile(userId, form)
      setData(result)
      setForm(result.profile ?? emptyProfile)
      setMessage('Ficha atualizada.')
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível salvar a ficha'))
    } finally {
      setBusy(false)
    }
  }

  if (!data) return <p className="form-message" role="status">{message || 'Carregando ficha do cliente…'}</p>

  return (
    <section className="customer-profile" aria-label="Ficha interna do cliente">
      <LoyaltyCardPanel userId={userId} canRedeem />
      <div className="profile-history">
        <strong>{data.history.completedAppointments} concluído(s)</strong>
        <span>{data.history.noShows} falta(s)</span>
        <span>Ticket médio: {formatCurrency(data.history.averageTicket)}</span>
        {data.history.lastService && <span>Último: {data.history.lastService.name} com {data.history.lastBarber?.name}</span>}
      </div>
      <form className="service-form" onSubmit={save}>
        <label>Como gosta do corte<textarea value={form.preferences ?? ''} onChange={(event) => setForm({ ...form, preferences: event.target.value || null })} maxLength={2000} /></label>
        <label>Alergias<textarea value={form.allergies ?? ''} onChange={(event) => setForm({ ...form, allergies: event.target.value || null })} maxLength={2000} /></label>
        <label>Observações internas<textarea value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value || null })} maxLength={2000} /></label>
        {data.profile && <small>Atualizada por {data.profile.updatedBy.name} em {formatDate(data.profile.updatedAt)}</small>}
        {message && <p className="form-message" role="status">{message}</p>}
        <button className="button button-small button-dark" disabled={busy}>{busy ? 'Salvando…' : 'Salvar ficha'}</button>
      </form>
    </section>
  )
}
