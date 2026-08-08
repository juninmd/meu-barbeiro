import { BellRing, CalendarOff, Check, CreditCard, Gift, Link2, Save, Store, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { Barbershop, Holiday, LoyaltyProgramInput } from '../../types'

interface BarbershopSettingsProps {
  barbershop: Barbershop
  onRefresh: () => Promise<void>
}

const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function BarbershopSettings({ barbershop, onRefresh }: BarbershopSettingsProps) {
  const [form, setForm] = useState(barbershop)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [disconnectError, setDisconnectError] = useState<string | null>(null)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [holidayForm, setHolidayForm] = useState({ date: '', description: '' })
  const [holidayBusy, setHolidayBusy] = useState(false)
  const [holidayMessage, setHolidayMessage] = useState<string | null>(null)
  const [holidayTarget, setHolidayTarget] = useState<Holiday | null>(null)
  const [holidayDeleteError, setHolidayDeleteError] = useState<string | null>(null)
  const [loyaltyForm, setLoyaltyForm] = useState<LoyaltyProgramInput>({ enabled: false, requiredVisits: 10, rewardDescription: 'Um corte por nossa conta' })
  const [loyaltyBusy, setLoyaltyBusy] = useState(false)
  const [loyaltyMessage, setLoyaltyMessage] = useState<string | null>(null)

  useEffect(() => setForm(barbershop), [barbershop])
  useEffect(() => {
    let active = true
    repository.holidays()
      .then((items) => { if (active) setHolidays(items) })
      .catch((error) => { if (active) setHolidayMessage(errorMessage(error, 'Não foi possível carregar os feriados')) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    let active = true
    repository.loyaltyProgram()
      .then((program) => { if (active && program) setLoyaltyForm(program) })
      .catch((error) => { if (active) setLoyaltyMessage(errorMessage(error, 'Não foi possível carregar o programa de fidelidade')) })
    return () => { active = false }
  }, [])

  const updateForm = (next: Barbershop) => {
    setForm(next)
    setSaved(false)
    setMessage(null)
  }

  const act = async (action: () => Promise<void>, success: string) => {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      await onRefresh()
      setMessage(success)
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível salvar a configuração'))
    } finally {
      setBusy(false)
    }
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await repository.updateBarbershop(form)
      await onRefresh()
      setMessage('Configurações publicadas.')
      setSaved(true)
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível salvar a configuração'))
    } finally {
      setBusy(false)
    }
  }

  const subscribe = () => void act(async () => {
    const { checkoutUrl } = await repository.subscribe()
    if (checkoutUrl) window.location.assign(checkoutUrl)
  }, 'Assinatura ativada com sucesso.')

  const connect = () => void act(async () => {
    const { authorizationUrl } = await repository.connectMercadoPago()
    if (authorizationUrl) window.location.assign(authorizationUrl)
  }, 'Mercado Pago conectado.')

  const disconnect = async () => {
    setBusy(true)
    setDisconnectError(null)
    try {
      await repository.disconnectMercadoPago()
      setDisconnectOpen(false)
      await onRefresh()
      setMessage('Mercado Pago desconectado.')
    } catch (error) {
      setDisconnectError(errorMessage(error, 'Não foi possível salvar a configuração'))
    } finally {
      setBusy(false)
    }
  }

  const createHoliday = async (event: React.FormEvent) => {
    event.preventDefault()
    setHolidayBusy(true)
    setHolidayMessage(null)
    try {
      await repository.createHoliday(holidayForm)
      setHolidays(await repository.holidays())
      setHolidayForm({ date: '', description: '' })
      setHolidayMessage('Feriado cadastrado.')
    } catch (error) {
      setHolidayMessage(errorMessage(error, 'Não foi possível cadastrar o feriado'))
    } finally {
      setHolidayBusy(false)
    }
  }

  const deleteHoliday = async () => {
    if (!holidayTarget) return
    setHolidayBusy(true)
    setHolidayDeleteError(null)
    try {
      await repository.deleteHoliday(holidayTarget.id)
      setHolidays(await repository.holidays())
      setHolidayTarget(null)
      setHolidayMessage('Feriado removido.')
    } catch (error) {
      setHolidayDeleteError(errorMessage(error, 'Não foi possível remover o feriado'))
    } finally {
      setHolidayBusy(false)
    }
  }

  const saveLoyalty = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoyaltyBusy(true)
    setLoyaltyMessage(null)
    try {
      const program = await repository.updateLoyaltyProgram(loyaltyForm)
      setLoyaltyForm(program)
      setLoyaltyMessage('Programa de fidelidade atualizado.')
    } catch (error) {
      setLoyaltyMessage(errorMessage(error, 'Não foi possível salvar o programa de fidelidade'))
    } finally {
      setLoyaltyBusy(false)
    }
  }

  if (barbershop.membershipRole !== 'OWNER' && barbershop.membershipRole !== 'ADMIN') return null

  return (
    <>
    <section className="settings-stack" aria-labelledby="settings-title">
      <div className="section-heading">
        <div><p className="eyebrow">Operação SaaS</p><h2 id="settings-title">Sua barbearia</h2></div>
      </div>

      <div className="billing-grid">
        <article className="billing-card">
          <CreditCard aria-hidden="true" />
          <span>Assinatura do sistema</span>
          <strong>{formatCurrency(barbershop.monthlyFeeCents / 100)}<small>/mês</small></strong>
          <p>Status: <b>{subscriptionLabel(barbershop.subscriptionStatus)}</b></p>
          {barbershop.subscriptionStatus !== 'ACTIVE' && (
            <button className="button button-primary" disabled={busy} onClick={subscribe}>Assinar por R$ 20/mês</button>
          )}
        </article>
        <article className="billing-card">
          <Link2 aria-hidden="true" />
          <span>Recebimentos</span>
          <strong>Mercado Pago</strong>
          <p>{barbershop.mercadoPagoConnected ? 'Conta conectada' : 'Conecte a conta que receberá os serviços'}</p>
          <button className={`button ${barbershop.mercadoPagoConnected ? 'button-ghost' : 'button-primary'}`} disabled={busy} onClick={barbershop.mercadoPagoConnected ? () => {
            setMessage(null)
            setDisconnectError(null)
            setDisconnectOpen(true)
          } : connect}>
            {barbershop.mercadoPagoConnected ? 'Desconectar' : 'Conectar Mercado Pago'}
          </button>
        </article>
        <article className="billing-card">
          <Store aria-hidden="true" />
          <span>Comissão da plataforma</span>
          <strong>{barbershop.commissionBps / 100}%</strong>
          <p>Calculada sobre o valor de cada serviço pago.</p>
        </article>
      </div>

      <form className="panel settings-form" onSubmit={save}>
        <div className="settings-columns">
          <fieldset>
            <legend>Marca e endereço</legend>
            <label>Nome<input value={form.name} minLength={3} required onChange={(event) => updateForm({ ...form, name: event.target.value })} /></label>
            <label>URL do logotipo<input type="url" placeholder="https://.../logo.png" value={form.logoUrl || ''} onChange={(event) => updateForm({ ...form, logoUrl: event.target.value })} /></label>
            <label>Cor principal<input type="color" value={form.primaryColor} onChange={(event) => updateForm({ ...form, primaryColor: event.target.value })} /></label>
            <label>Endereço<input value={form.address || ''} onChange={(event) => updateForm({ ...form, address: event.target.value })} /></label>
          </fieldset>

          <fieldset>
            <legend>Pagamento antecipado</legend>
            <label>Tipo de sinal
              <select value={form.depositType} onChange={(event) => updateForm({ ...form, depositType: event.target.value as Barbershop['depositType'], depositValue: 0 })}>
                <option value="NONE">Sem sinal</option>
                <option value="FULL">Pagamento integral</option>
                <option value="PERCENTAGE">Percentual</option>
                <option value="FIXED">Valor fixo</option>
              </select>
            </label>
            {form.depositType === 'PERCENTAGE' && (
              <label>Percentual<input type="number" min="1" max="100" value={form.depositValue || ''} onChange={(event) => updateForm({ ...form, depositValue: Number(event.target.value) })} required /></label>
            )}
            {form.depositType === 'FIXED' && (
              <label>Valor do sinal (R$)<input type="number" min="0.01" step="0.01" value={form.depositValue ? form.depositValue / 100 : ''} onChange={(event) => updateForm({ ...form, depositValue: Math.round(Number(event.target.value) * 100) })} required /></label>
            )}
            <p className="settings-hint">A comissão permanece em 1% do serviço. O Mercado Pago desconta a tarifa própria antes do repasse.</p>
          </fieldset>

          <fieldset>
            <legend>Cancelamento</legend>
            <label>Janela de cancelamento tardio (horas)<input type="number" min="0" max="720" value={form.cancellationWindowHours} onChange={(event) => updateForm({ ...form, cancellationWindowHours: Number(event.target.value) })} required /></label>
            <label>Percentual do sinal retido<input type="number" min="0" max="100" step="0.01" value={form.lateCancellationFeeBps / 100} onChange={(event) => updateForm({ ...form, lateCancellationFeeBps: Math.round(Number(event.target.value) * 100) })} required /></label>
            <p className="settings-hint">Se o cliente cancelar faltando até {form.cancellationWindowHours} hora(s), a barbearia retém {form.lateCancellationFeeBps / 100}% do sinal. Fora dessa janela, ou quando a própria barbearia cancela, o valor é devolvido integralmente.</p>
          </fieldset>

          <fieldset>
            <legend><BellRing aria-hidden="true" /> Lembretes automáticos</legend>
            <label className="hour-toggle"><input type="checkbox" checked={form.remindersEnabled ?? true} onChange={(event) => updateForm({ ...form, remindersEnabled: event.target.checked })} /> Enviar pelo Telegram</label>
            <p className="settings-hint">Escolha quando o cliente deve receber o aviso. O lembrete de 24 horas permite confirmar presença.</p>
            {[24, 2].map((hour) => {
              const selected = (form.reminderHoursBefore ?? [24, 2]).includes(hour)
              return (
                <label className="hour-toggle" key={hour}>
                  <input type="checkbox" checked={selected} disabled={selected && (form.reminderHoursBefore ?? [24, 2]).length === 1} onChange={(event) => {
                    const current = form.reminderHoursBefore ?? [24, 2]
                    const reminderHoursBefore = event.target.checked
                      ? [...current, hour].sort((left, right) => right - left)
                      : current.filter((item) => item !== hour)
                    updateForm({ ...form, reminderHoursBefore })
                  }} /> {hour === 24 ? '24 horas antes' : '2 horas antes'}
                </label>
              )
            })}
          </fieldset>
        </div>

        <fieldset>
          <legend>Horários de funcionamento</legend>
          <p className="settings-hint">O intervalo de almoço é opcional e bloqueia novos agendamentos durante esse período.</p>
          <div className="hours-grid">
            {form.businessHours.map((hour, index) => (
              <div className="hour-row" key={hour.weekday}>
                <label className="hour-toggle"><input type="checkbox" checked={hour.enabled} onChange={(event) => {
                  const next = [...form.businessHours]
                  next[index] = {
                    ...hour,
                    enabled: event.target.checked,
                    ...(!event.target.checked && { breakStartsAt: null, breakEndsAt: null }),
                  }
                  updateForm({ ...form, businessHours: next })
                }} /> {weekdays[hour.weekday]}</label>
                <input aria-label={`Abertura ${weekdays[hour.weekday]}`} type="time" value={hour.opensAt} disabled={!hour.enabled} onChange={(event) => {
                  const next = [...form.businessHours]
                  next[index] = { ...hour, opensAt: event.target.value }
                  updateForm({ ...form, businessHours: next })
                }} />
                <span>até</span>
                <input aria-label={`Fechamento ${weekdays[hour.weekday]}`} type="time" value={hour.closesAt} disabled={!hour.enabled} onChange={(event) => {
                  const next = [...form.businessHours]
                  next[index] = { ...hour, closesAt: event.target.value }
                  updateForm({ ...form, businessHours: next })
                }} />
                <span>almoço</span>
                <input aria-label={`Início do almoço ${weekdays[hour.weekday]}`} type="time" value={hour.breakStartsAt || ''} disabled={!hour.enabled} onChange={(event) => {
                  const next = [...form.businessHours]
                  next[index] = { ...hour, breakStartsAt: event.target.value || null }
                  updateForm({ ...form, businessHours: next })
                }} />
                <span>até</span>
                <input aria-label={`Fim do almoço ${weekdays[hour.weekday]}`} type="time" value={hour.breakEndsAt || ''} disabled={!hour.enabled} onChange={(event) => {
                  const next = [...form.businessHours]
                  next[index] = { ...hour, breakEndsAt: event.target.value || null }
                  updateForm({ ...form, businessHours: next })
                }} />
              </div>
            ))}
          </div>
        </fieldset>

        {message && <p className="form-message" role="status">{message}</p>}
        <button className="button button-dark" disabled={busy || saved}>
          {saved ? <Check aria-hidden="true" /> : <Save aria-hidden="true" />}
          {saved ? 'Configurações salvas' : 'Salvar configurações'}
        </button>
      </form>

      <form className="panel settings-form loyalty-settings" onSubmit={saveLoyalty}>
        <div className="section-heading compact">
          <div><p className="eyebrow">Retenção</p><h3><Gift aria-hidden="true" /> Programa de fidelidade</h3></div>
        </div>
        <label className="hour-toggle"><input type="checkbox" checked={loyaltyForm.enabled} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, enabled: event.target.checked })} /> Programa ativo</label>
        <div className="settings-columns">
          <label>Visitas para ganhar<input type="number" min="1" max="100" value={loyaltyForm.requiredVisits} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, requiredVisits: Number(event.target.value) })} required /></label>
          <label>Prêmio<input minLength={3} maxLength={160} value={loyaltyForm.rewardDescription} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, rewardDescription: event.target.value })} required /></label>
        </div>
        <p className="settings-hint">Cada atendimento concluído (DONE) gera um selo. Cancelamentos, faltas e atendimentos ainda agendados não geram.</p>
        {loyaltyMessage && <p className="form-message" role="status">{loyaltyMessage}</p>}
        <button className="button button-dark" disabled={loyaltyBusy}>{loyaltyBusy ? 'Salvando…' : 'Salvar fidelidade'}</button>
      </form>

      <section className="panel holiday-settings" aria-labelledby="holidays-title">
        <div className="section-heading">
          <div><p className="eyebrow">Agenda bloqueada</p><h3 id="holidays-title">Feriados</h3></div>
          <CalendarOff aria-hidden="true" />
        </div>
        <p className="settings-hint">Nas datas cadastradas, nenhum horário ficará disponível para agendamento.</p>
        <form className="holiday-form" onSubmit={createHoliday}>
          <label>Data<input type="date" required value={holidayForm.date} onChange={(event) => setHolidayForm({ ...holidayForm, date: event.target.value })} /></label>
          <label>Descrição<input minLength={3} maxLength={80} required placeholder="Ex.: Natal" value={holidayForm.description} onChange={(event) => setHolidayForm({ ...holidayForm, description: event.target.value })} /></label>
          <button className="button button-dark" disabled={holidayBusy}>Cadastrar feriado</button>
        </form>
        {holidayMessage && <p className="form-message" role="status">{holidayMessage}</p>}
        {holidays.length === 0 ? (
          <p className="empty-inline">Nenhum feriado cadastrado.</p>
        ) : (
          <div className="holiday-list">
            {holidays.map((holiday) => (
              <div className="holiday-item" key={holiday.id}>
                <div><strong>{formatHolidayDate(holiday.date)}</strong><span>{holiday.description}</span></div>
                <button className="icon-button danger" aria-label={`Remover ${holiday.description}`} disabled={holidayBusy} onClick={() => {
                  setHolidayDeleteError(null)
                  setHolidayTarget(holiday)
                }} type="button"><Trash2 aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
    {disconnectOpen && (
      <ConfirmDialog
        eyebrow="Confirmar desconexão"
        title="Desconectar o Mercado Pago?"
        description="Os clientes não conseguirão pagar pelos serviços até que uma conta seja conectada novamente."
        cancelLabel="Manter conectado"
        confirmLabel={busy ? 'Desconectando…' : 'Sim, desconectar'}
        busy={busy}
        error={disconnectError}
        onCancel={() => {
          setDisconnectError(null)
          setDisconnectOpen(false)
        }}
        onConfirm={() => void disconnect()}
      />
    )}
    {holidayTarget && (
      <ConfirmDialog
        eyebrow="Confirmar remoção"
        title="Remover este feriado?"
        description={`${formatHolidayDate(holidayTarget.date)} · ${holidayTarget.description}. A data voltará a aceitar agendamentos.`}
        cancelLabel="Manter feriado"
        confirmLabel={holidayBusy ? 'Removendo…' : 'Sim, remover'}
        busy={holidayBusy}
        error={holidayDeleteError}
        onCancel={() => {
          setHolidayDeleteError(null)
          setHolidayTarget(null)
        }}
        onConfirm={() => void deleteHoliday()}
      />
    )}
    </>
  )
}

const subscriptionLabel = (status: Barbershop['subscriptionStatus']) => ({
  ACTIVE: 'Ativa', PENDING: 'Aguardando pagamento', PAST_DUE: 'Pagamento atrasado', CANCELED: 'Cancelada', INACTIVE: 'Inativa',
})[status || 'INACTIVE']

const formatHolidayDate = (date: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' })
  .format(new Date(`${date}T00:00:00.000Z`))
