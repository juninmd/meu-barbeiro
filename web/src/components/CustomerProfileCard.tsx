import { useEffect, useState } from 'react'
import { formatCurrency, formatDate } from '../lib/format'
import { errorMessage, repository } from '../lib/repository'
import type { CustomerProfileFields, CustomerProfileResponse } from '../types'
import { CustomerPackagesAdmin } from './CustomerPackages'
import { LoyaltyCardPanel } from './LoyaltyCardPanel'
import { Button } from './ui/Button'
import { Field, Textarea } from './ui/Field'
import { InsetForm } from './ui/FormParts'
import { Notice } from './ui/Notice'

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

  if (!data) return <Notice role="status">{message || 'Carregando ficha do cliente…'}</Notice>

  return (
    <section className="mt-3 grid gap-4 rounded-xl border border-line bg-surface-3 p-4" aria-label="Ficha interna do cliente">
      <LoyaltyCardPanel userId={userId} canRedeem />
      <CustomerPackagesAdmin userId={userId} />
      <div className="grid gap-0.5 text-sm text-muted [&_strong]:text-ink">
        <strong>{data.history.completedAppointments} concluído(s)</strong>
        <span>{data.history.noShows} falta(s)</span>
        <span>Ticket médio: {formatCurrency(data.history.averageTicket)}</span>
        {data.history.lastService && <span>Último: {data.history.lastService.name} com {data.history.lastBarber?.name}</span>}
      </div>
      <InsetForm onSubmit={save}>
        <Field label="Como gosta do corte"><Textarea value={form.preferences ?? ''} onChange={(event) => setForm({ ...form, preferences: event.target.value || null })} maxLength={2000} /></Field>
        <Field label="Alergias"><Textarea value={form.allergies ?? ''} onChange={(event) => setForm({ ...form, allergies: event.target.value || null })} maxLength={2000} /></Field>
        <Field label="Observações internas"><Textarea value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value || null })} maxLength={2000} /></Field>
        {data.profile && <small className="text-xs text-muted">Atualizada por {data.profile.updatedBy.name} em {formatDate(data.profile.updatedAt)}</small>}
        {message && <Notice role="status">{message}</Notice>}
        <Button type="submit" variant="dark" size="sm" loading={busy} className="justify-self-start">{busy ? 'Salvando…' : 'Salvar ficha'}</Button>
      </InsetForm>
    </section>
  )
}
