import { BellRing, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { errorMessage, repository } from '../../lib/repository'
import type { NotificationPreferences, StaffNotificationType } from '../../types'

const notificationOptions: Array<{ type: StaffNotificationType; label: string }> = [
  { type: 'NEW_APPOINTMENT', label: 'Novos agendamentos' },
  { type: 'CANCELLATION', label: 'Cancelamentos' },
  { type: 'RESCHEDULE', label: 'Remarcações' },
  { type: 'NO_SHOW', label: 'Faltas registradas' },
  { type: 'DAILY_SUMMARY', label: 'Resumo do dia' },
]

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    repository.notificationPreferences()
      .then((loaded) => { if (active) setPreferences(loaded) })
      .catch((error) => { if (active) setMessage(errorMessage(error, 'Não foi possível carregar seus avisos')) })
    return () => { active = false }
  }, [])

  if (!preferences) return message ? <p className="form-message" role="alert">{message}</p> : null

  const toggle = (type: StaffNotificationType, checked: boolean) => {
    setPreferences({
      ...preferences,
      notificationTypes: checked
        ? [...preferences.notificationTypes, type]
        : preferences.notificationTypes.filter((current) => current !== type),
    })
    setMessage(null)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      setPreferences(await repository.updateNotificationPreferences({
        notificationTypes: preferences.notificationTypes,
        dailySummaryTime: preferences.dailySummaryTime,
      }))
      setMessage('Preferências de aviso salvas.')
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível salvar seus avisos'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel settings-form" onSubmit={save}>
      <div className="section-heading compact">
        <div><p className="eyebrow">Seu canal</p><h2><BellRing aria-hidden="true" /> Avisos da agenda</h2></div>
      </div>
      {!preferences.telegramLinked && (
        <div className="payment-warning" role="alert"><strong>Telegram não vinculado.</strong><p>Suas preferências ficam salvas, mas nenhum aviso chegará até você vincular o canal.</p></div>
      )}
      <fieldset>
        <legend>O que você quer receber</legend>
        {notificationOptions.map((option) => (
          <label className="hour-toggle" key={option.type}>
            <input type="checkbox" checked={preferences.notificationTypes.includes(option.type)} onChange={(event) => toggle(option.type, event.target.checked)} /> {option.label}
          </label>
        ))}
      </fieldset>
      <label>Horário do resumo diário<input type="time" required value={preferences.dailySummaryTime} onChange={(event) => setPreferences({ ...preferences, dailySummaryTime: event.target.value })} /></label>
      <p className="settings-hint">O horário segue o fuso configurado para a barbearia.</p>
      {message && <p className="form-message" role="status">{message}</p>}
      <button className="button button-dark" disabled={busy}><Save aria-hidden="true" /> {busy ? 'Salvando…' : 'Salvar meus avisos'}</button>
    </form>
  )
}
