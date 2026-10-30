import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { errorMessage, repository } from '../../lib/repository'
import type { Barber, BarberAbsence, BarberSchedule, Barbershop, User } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input, inputStyles } from '../../components/ui/Field'
import { Notice, SectionHeading } from '../../components/ui/Notice'
import { cardStyles } from '../../components/ui/Card'
import { cn } from '../../lib/cn'

const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

interface BarberAvailabilityProps {
  barbers: Barber[]
  barbershop: Barbershop
  currentUser: User
  onChanged: () => void
}

export function BarberAvailability({ barbers, barbershop, currentUser, onChanged }: BarberAvailabilityProps) {
  const canChoose = barbershop.membershipRole === 'OWNER' || barbershop.membershipRole === 'ADMIN'
  const [barberId, setBarberId] = useState(canChoose ? barbers[0]?.id ?? currentUser.id : currentUser.id)
  const [schedule, setSchedule] = useState<BarberSchedule[]>([])
  const [usingFallback, setUsingFallback] = useState(true)
  const [absences, setAbsences] = useState<BarberAbsence[]>([])
  const [absenceForm, setAbsenceForm] = useState({ startsAt: '', endsAt: '', reason: '' })
  const [target, setTarget] = useState<BarberAbsence | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!barberId) return
    setMessage(null)
    Promise.all([repository.barberSchedule(barberId), repository.barberAbsences(barberId)])
      .then(([savedSchedule, savedAbsences]) => {
        setUsingFallback(savedSchedule.length === 0)
        setSchedule(savedSchedule.length > 0 ? savedSchedule : barbershop.businessHours.map((item) => ({
          weekday: item.weekday,
          startsAt: item.opensAt,
          endsAt: item.closesAt,
          enabled: item.enabled,
        })))
        setAbsences(savedAbsences)
      })
      .catch((error) => setMessage(errorMessage(error, 'Não foi possível carregar a disponibilidade')))
  }, [barberId, barbershop.businessHours])

  const updateDay = (weekday: number, changes: Partial<BarberSchedule>) => {
    setSchedule((current) => current.map((item) => item.weekday === weekday ? { ...item, ...changes } : item))
  }

  const saveSchedule = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const saved = await repository.updateBarberSchedule(barberId, schedule)
      setSchedule(saved)
      setUsingFallback(false)
      setMessage('Escala semanal salva.')
      onChanged()
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível salvar a escala'))
    } finally {
      setBusy(false)
    }
  }

  const restoreFallback = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await repository.updateBarberSchedule(barberId, [])
      setUsingFallback(true)
      setSchedule(barbershop.businessHours.map((item) => ({
        weekday: item.weekday, startsAt: item.opensAt, endsAt: item.closesAt, enabled: item.enabled,
      })))
      setMessage('O expediente da barbearia voltou a ser o padrão.')
      onChanged()
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível restaurar o expediente padrão'))
    } finally {
      setBusy(false)
    }
  }

  const createAbsence = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await repository.createBarberAbsence(barberId, {
        startsAt: new Date(absenceForm.startsAt).toISOString(),
        endsAt: new Date(absenceForm.endsAt).toISOString(),
        reason: absenceForm.reason,
      })
      setAbsences(await repository.barberAbsences(barberId))
      setAbsenceForm({ startsAt: '', endsAt: '', reason: '' })
      setMessage('Ausência cadastrada.')
      onChanged()
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível cadastrar a ausência'))
    } finally {
      setBusy(false)
    }
  }

  const deleteAbsence = async () => {
    if (!target) return
    setBusy(true)
    setDeleteError(null)
    try {
      await repository.deleteBarberAbsence(barberId, target.id)
      setAbsences(await repository.barberAbsences(barberId))
      setTarget(null)
      onChanged()
    } catch (error) {
      setDeleteError(errorMessage(error, 'Não foi possível remover a ausência'))
    } finally {
      setBusy(false)
    }
  }

  const formatDateTime = (value: string) => new Intl.DateTimeFormat('pt-BR', {
    timeZone: barbershop.timezone, dateStyle: 'short', timeStyle: 'short',
  }).format(new Date(value))

  const miniLabel = 'grid min-w-0 gap-1 text-[.68rem] font-extrabold tracking-wide text-muted uppercase'

  return (
    <>
      <section className={cn(cardStyles, 'mt-4 grid gap-6')} aria-labelledby="availability-title">
        <SectionHeading
          eyebrow="Agenda individual" title="Disponibilidade" id="availability-title"
          aside={canChoose && (
            <label className={cn(miniLabel, 'w-full sm:w-64')}>Barbeiro
              <select className={inputStyles('text-base font-normal tracking-normal normal-case')} value={barberId} onChange={(event) => setBarberId(event.target.value)}>
                {barbers.map((barber) => <option value={barber.id} key={barber.id}>{barber.name}</option>)}
              </select>
            </label>
          )}
        />

        <div className="grid gap-4 border-t border-line pt-5">
          <div>
            <h3 className="font-serif text-lg font-medium">Escala semanal</h3>
            <p className="text-sm text-muted">{usingFallback ? 'Usando o expediente da barbearia.' : 'Escala própria ativa; a loja continua sendo o limite.'}</p>
          </div>
          <div className="grid gap-2.5 lg:grid-cols-2">
            {schedule.map((day) => (
              <div className={cn('grid grid-cols-2 items-end gap-3 rounded-xl bg-surface-2 p-3.5 sm:grid-cols-[minmax(7rem,1fr)_1fr_1fr]', !day.enabled && 'opacity-80')} key={day.weekday}>
                <label className="col-span-2 flex min-h-11 cursor-pointer items-center gap-2.5 font-bold sm:col-span-1 sm:self-center">
                  <input className="size-5 accent-brand" type="checkbox" checked={day.enabled} onChange={(event) => updateDay(day.weekday, { enabled: event.target.checked })} /> {weekdays[day.weekday]}
                </label>
                <label className={miniLabel}>Início<Input type="time" required value={day.startsAt} disabled={!day.enabled} onChange={(event) => updateDay(day.weekday, { startsAt: event.target.value })} /></label>
                <label className={miniLabel}>Fim<Input type="time" required value={day.endsAt} disabled={!day.enabled} onChange={(event) => updateDay(day.weekday, { endsAt: event.target.value })} /></label>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="dark" loading={busy} onClick={saveSchedule}>Salvar escala</Button>
            {!usingFallback && <Button variant="ghost" disabled={busy} onClick={restoreFallback}>Usar expediente da barbearia</Button>}
          </div>
        </div>

        <div className="grid gap-4 border-t border-line pt-5">
          <h3 className="font-serif text-lg font-medium">Ausências</h3>
          <form className="grid items-end gap-3 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]" onSubmit={createAbsence}>
            <label className={miniLabel}>Início<Input type="datetime-local" required value={absenceForm.startsAt} onChange={(event) => setAbsenceForm({ ...absenceForm, startsAt: event.target.value })} /></label>
            <label className={miniLabel}>Fim<Input type="datetime-local" required value={absenceForm.endsAt} onChange={(event) => setAbsenceForm({ ...absenceForm, endsAt: event.target.value })} /></label>
            <label className={miniLabel}>Motivo<Input required maxLength={200} value={absenceForm.reason} onChange={(event) => setAbsenceForm({ ...absenceForm, reason: event.target.value })} placeholder="Ex.: consulta médica" /></label>
            <Button type="submit" variant="dark" disabled={busy}>Cadastrar ausência</Button>
          </form>
          {absences.length === 0 ? <p className="text-sm text-muted">Nenhuma ausência futura.</p> : (
            <ul className="grid gap-2.5">
              {absences.map((absence) => (
                <li className="flex items-center justify-between gap-4 rounded-xl border border-line p-3" key={absence.id}>
                  <div className="grid gap-0.5"><strong>{absence.reason}</strong><span className="text-sm text-muted">{formatDateTime(absence.startsAt)} até {formatDateTime(absence.endsAt)}</span></div>
                  <button className="grid size-11 shrink-0 place-items-center rounded-full border border-line text-danger transition hover:border-danger hover:bg-danger-soft focus-visible:ring-4 focus-visible:ring-danger/25 focus-visible:outline-none" type="button" aria-label={`Remover ausência: ${absence.reason}`} onClick={() => setTarget(absence)}><Trash2 className="size-[1.1rem]" aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {message && <Notice tone="info" role="status">{message}</Notice>}
      </section>
      {target && <ConfirmDialog eyebrow="Remover ausência" title={`Remover ${target.reason}?`} description="O período voltará a aceitar agendamentos conforme a escala." cancelLabel="Manter ausência" confirmLabel={busy ? 'Removendo…' : 'Sim, remover'} busy={busy} error={deleteError} onCancel={() => { setDeleteError(null); setTarget(null) }} onConfirm={deleteAbsence} />}
    </>
  )
}
