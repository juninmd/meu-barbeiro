import { CalendarOff, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { errorMessage, repository } from '../../lib/repository'
import type { Barber, BarberAbsence, BarberSchedule, Barbershop, User } from '../../types'

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

  return (
    <>
      <section className="panel availability-panel" aria-labelledby="availability-title">
        <div className="section-heading">
          <div><p className="eyebrow"><CalendarOff aria-hidden="true" /> Agenda individual</p><h2 id="availability-title">Disponibilidade</h2></div>
          {canChoose && <label>Barbeiro<select value={barberId} onChange={(event) => setBarberId(event.target.value)}>{barbers.map((barber) => <option value={barber.id} key={barber.id}>{barber.name}</option>)}</select></label>}
        </div>

        <div className="availability-block">
          <div className="section-heading compact"><div><h3>Escala semanal</h3><p>{usingFallback ? 'Usando o expediente da barbearia.' : 'Escala própria ativa; a loja continua sendo o limite.'}</p></div></div>
          <div className="schedule-list">
            {schedule.map((day) => (
              <div className="schedule-row" key={day.weekday}>
                <label className="schedule-enabled"><input type="checkbox" checked={day.enabled} onChange={(event) => updateDay(day.weekday, { enabled: event.target.checked })} /> {weekdays[day.weekday]}</label>
                <label>Início<input type="time" required value={day.startsAt} disabled={!day.enabled} onChange={(event) => updateDay(day.weekday, { startsAt: event.target.value })} /></label>
                <label>Fim<input type="time" required value={day.endsAt} disabled={!day.enabled} onChange={(event) => updateDay(day.weekday, { endsAt: event.target.value })} /></label>
              </div>
            ))}
          </div>
          <div className="action-row">
            <button className="button button-dark" type="button" disabled={busy} onClick={saveSchedule}>Salvar escala</button>
            {!usingFallback && <button className="button button-ghost" type="button" disabled={busy} onClick={restoreFallback}>Usar expediente da barbearia</button>}
          </div>
        </div>

        <div className="availability-block">
          <h3>Ausências</h3>
          <form className="absence-form" onSubmit={createAbsence}>
            <label>Início<input type="datetime-local" required value={absenceForm.startsAt} onChange={(event) => setAbsenceForm({ ...absenceForm, startsAt: event.target.value })} /></label>
            <label>Fim<input type="datetime-local" required value={absenceForm.endsAt} onChange={(event) => setAbsenceForm({ ...absenceForm, endsAt: event.target.value })} /></label>
            <label>Motivo<input required maxLength={200} value={absenceForm.reason} onChange={(event) => setAbsenceForm({ ...absenceForm, reason: event.target.value })} placeholder="Ex.: consulta médica" /></label>
            <button className="button button-dark" disabled={busy}>Cadastrar ausência</button>
          </form>
          {absences.length === 0 ? <p className="empty-copy">Nenhuma ausência futura.</p> : <div className="absence-list">{absences.map((absence) => (
            <div className="absence-item" key={absence.id}><div><strong>{absence.reason}</strong><span>{formatDateTime(absence.startsAt)} até {formatDateTime(absence.endsAt)}</span></div><button className="icon-button danger" type="button" aria-label={`Remover ausência: ${absence.reason}`} onClick={() => setTarget(absence)}><Trash2 aria-hidden="true" /></button></div>
          ))}</div>}
        </div>
        {message && <p className="form-message" role="status">{message}</p>}
      </section>
      {target && <ConfirmDialog eyebrow="Remover ausência" title={`Remover ${target.reason}?`} description="O período voltará a aceitar agendamentos conforme a escala." cancelLabel="Manter ausência" confirmLabel={busy ? 'Removendo…' : 'Sim, remover'} busy={busy} error={deleteError} onCancel={() => { setDeleteError(null); setTarget(null) }} onConfirm={deleteAbsence} />}
    </>
  )
}
