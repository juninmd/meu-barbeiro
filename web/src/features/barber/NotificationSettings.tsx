import { BellRing, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { errorMessage, repository } from '../../lib/repository'
import type { NotificationPreferences, StaffNotificationType } from '../../types'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Group, Hint, Toggle } from '../../components/ui/FormParts'
import { Eyebrow, Notice } from '../../components/ui/Notice'
import { cardStyles } from '../../components/ui/Card'
import { cn } from '../../lib/cn'

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

  if (!preferences) return message ? <Notice tone="danger" role="alert">{message}</Notice> : null

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
    <form className={cn(cardStyles, 'grid gap-4')} onSubmit={save}>
      <div>
        <Eyebrow>Seu canal</Eyebrow>
        <h2 className="flex items-center gap-2 font-serif text-xl font-medium [&_svg]:size-5 [&_svg]:text-brand-deep"><BellRing aria-hidden="true" /> Avisos da agenda</h2>
      </div>
      {!preferences.telegramLinked && (
        <Notice tone="danger" role="alert"><strong>Telegram não vinculado.</strong> Suas preferências ficam salvas, mas nenhum aviso chegará até você vincular o canal.</Notice>
      )}
      <Group legend="O que você quer receber">
        {notificationOptions.map((option) => (
          <Toggle key={option.type} checked={preferences.notificationTypes.includes(option.type)} onChange={(checked) => toggle(option.type, checked)}>{option.label}</Toggle>
        ))}
      </Group>
      <Field label="Horário do resumo diário"><Input type="time" required value={preferences.dailySummaryTime} onChange={(event) => setPreferences({ ...preferences, dailySummaryTime: event.target.value })} /></Field>
      <Hint>O horário segue o fuso configurado para a barbearia.</Hint>
      {message && <Notice role="status">{message}</Notice>}
      <Button type="submit" variant="dark" loading={busy} className="justify-self-start max-sm:w-full"><Save aria-hidden="true" /> {busy ? 'Salvando…' : 'Salvar meus avisos'}</Button>
    </form>
  )
}
