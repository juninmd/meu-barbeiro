import { BellRing, CalendarOff, Check, CreditCard, Gift, Link2, Save, Store, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { Barbershop, Holiday, LoyaltyProgramInput } from '../../types'
import { Button } from '../../components/ui/Button'
import { Field, Input, inputStyles } from '../../components/ui/Field'
import { Group, Hint, Toggle } from '../../components/ui/FormParts'
import { Eyebrow, Notice, SectionHeading } from '../../components/ui/Notice'
import { cardStyles } from '../../components/ui/Card'
import { cn } from '../../lib/cn'

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

  const patchHour = (index: number, changes: Partial<Barbershop['businessHours'][number]>) => {
    const next = [...form.businessHours]
    next[index] = { ...next[index], ...changes }
    updateForm({ ...form, businessHours: next })
  }

  return (
    <>
    <section className="mt-2 grid gap-5" aria-labelledby="settings-title">
      <SectionHeading eyebrow="Operação SaaS" title="Sua barbearia" id="settings-title" />

      <div className="grid gap-3 md:grid-cols-3">
        <BillingCard icon={<CreditCard />} label="Assinatura do sistema" value={<>{formatCurrency(barbershop.monthlyFeeCents / 100)}<small className="ml-1 text-sm font-normal text-muted">/mês</small></>}>
          <p>Status: <b className="text-ink">{subscriptionLabel(barbershop.subscriptionStatus)}</b></p>
          {barbershop.subscriptionStatus !== 'ACTIVE' && <Button loading={busy} onClick={subscribe}>Assinar por R$ 20/mês</Button>}
        </BillingCard>
        <BillingCard icon={<Link2 />} label="Recebimentos" value="Mercado Pago">
          <p>{barbershop.mercadoPagoConnected ? 'Conta conectada' : 'Conecte a conta que receberá os serviços'}</p>
          <Button variant={barbershop.mercadoPagoConnected ? 'ghost' : 'primary'} disabled={busy} onClick={barbershop.mercadoPagoConnected ? () => {
            setMessage(null)
            setDisconnectError(null)
            setDisconnectOpen(true)
          } : connect}>
            {barbershop.mercadoPagoConnected ? 'Desconectar' : 'Conectar Mercado Pago'}
          </Button>
        </BillingCard>
        <BillingCard icon={<Store />} label="Comissão da plataforma" value={`${barbershop.commissionBps / 100}%`}>
          <p>Calculada sobre o valor de cada serviço pago.</p>
        </BillingCard>
      </div>

      <form className={cn(cardStyles, 'grid gap-6')} onSubmit={save}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Group legend="Marca e endereço">
            <Field label="Nome"><Input value={form.name} minLength={3} required onChange={(event) => updateForm({ ...form, name: event.target.value })} /></Field>
            <Field label="URL do logotipo"><Input type="url" placeholder="https://.../logo.png" value={form.logoUrl || ''} onChange={(event) => updateForm({ ...form, logoUrl: event.target.value })} /></Field>
            <Field label="Cor principal"><Input type="color" className="h-12 cursor-pointer p-1.5" value={form.primaryColor} onChange={(event) => updateForm({ ...form, primaryColor: event.target.value })} /></Field>
            <Field label="Endereço"><Input value={form.address || ''} onChange={(event) => updateForm({ ...form, address: event.target.value })} /></Field>
          </Group>

          <Group legend="Pagamento antecipado">
            <Field label="Tipo de sinal">
              <select className={inputStyles()} value={form.depositType} onChange={(event) => updateForm({ ...form, depositType: event.target.value as Barbershop['depositType'], depositValue: 0 })}>
                <option value="NONE">Sem sinal</option>
                <option value="FULL">Pagamento integral</option>
                <option value="PERCENTAGE">Percentual</option>
                <option value="FIXED">Valor fixo</option>
              </select>
            </Field>
            {form.depositType === 'PERCENTAGE' && (
              <Field label="Percentual"><Input type="number" min="1" max="100" value={form.depositValue || ''} onChange={(event) => updateForm({ ...form, depositValue: Number(event.target.value) })} required /></Field>
            )}
            {form.depositType === 'FIXED' && (
              <Field label="Valor do sinal (R$)"><Input type="number" min="0.01" step="0.01" value={form.depositValue ? form.depositValue / 100 : ''} onChange={(event) => updateForm({ ...form, depositValue: Math.round(Number(event.target.value) * 100) })} required /></Field>
            )}
            <Hint>A comissão permanece em 1% do serviço. O Mercado Pago desconta a tarifa própria antes do repasse.</Hint>
          </Group>

          <Group legend="Cancelamento">
            <Field label="Janela de cancelamento tardio (horas)"><Input type="number" min="0" max="720" value={form.cancellationWindowHours} onChange={(event) => updateForm({ ...form, cancellationWindowHours: Number(event.target.value) })} required /></Field>
            <Field label="Percentual do sinal retido"><Input type="number" min="0" max="100" step="0.01" value={form.lateCancellationFeeBps / 100} onChange={(event) => updateForm({ ...form, lateCancellationFeeBps: Math.round(Number(event.target.value) * 100) })} required /></Field>
            <Hint>Se o cliente cancelar faltando até {form.cancellationWindowHours} hora(s), a barbearia retém {form.lateCancellationFeeBps / 100}% do sinal. Fora dessa janela, ou quando a própria barbearia cancela, o valor é devolvido integralmente.</Hint>
          </Group>

          <Group legend={<><BellRing aria-hidden="true" className="size-4 text-brand-deep" /> Lembretes automáticos</>}>
            <Toggle checked={form.remindersEnabled ?? true} onChange={(checked) => updateForm({ ...form, remindersEnabled: checked })}>Enviar pelo Telegram</Toggle>
            <Hint>Escolha quando o cliente deve receber o aviso. O lembrete de 24 horas permite confirmar presença.</Hint>
            {[24, 2].map((hour) => {
              const current = form.reminderHoursBefore ?? [24, 2]
              const selected = current.includes(hour)
              return (
                <Toggle key={hour} checked={selected} disabled={selected && current.length === 1} onChange={(checked) => {
                  const reminderHoursBefore = checked
                    ? [...current, hour].sort((left, right) => right - left)
                    : current.filter((item) => item !== hour)
                  updateForm({ ...form, reminderHoursBefore })
                }}>{hour === 24 ? '24 horas antes' : '2 horas antes'}</Toggle>
              )
            })}
          </Group>
        </div>

        <Group legend="Horários de funcionamento">
          <Hint>O intervalo de almoço é opcional e bloqueia novos agendamentos durante esse período.</Hint>
          <div className="grid gap-3 md:grid-cols-[repeat(auto-fill,minmax(min(100%,21rem),1fr))]">
            {form.businessHours.map((hour, index) => {
              const day = weekdays[hour.weekday]
              const time = 'min-h-11 min-w-0 px-2.5 py-1.5 text-sm'
              return (
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2 rounded-xl bg-surface-2 p-3" key={hour.weekday}>
                  <div className="col-span-3">
                    <Toggle checked={hour.enabled} onChange={(checked) => patchHour(index, { enabled: checked, ...(!checked && { breakStartsAt: null, breakEndsAt: null }) })}>{day}</Toggle>
                  </div>
                  <Input className={time} aria-label={`Abertura ${day}`} type="time" value={hour.opensAt} disabled={!hour.enabled} onChange={(event) => patchHour(index, { opensAt: event.target.value })} />
                  <span className="text-xs text-muted">até</span>
                  <Input className={time} aria-label={`Fechamento ${day}`} type="time" value={hour.closesAt} disabled={!hour.enabled} onChange={(event) => patchHour(index, { closesAt: event.target.value })} />
                  <span className="col-span-3 text-xs font-bold text-muted uppercase">almoço</span>
                  <Input className={time} aria-label={`Início do almoço ${day}`} type="time" value={hour.breakStartsAt || ''} disabled={!hour.enabled} onChange={(event) => patchHour(index, { breakStartsAt: event.target.value || null })} />
                  <span className="text-xs text-muted">até</span>
                  <Input className={time} aria-label={`Fim do almoço ${day}`} type="time" value={hour.breakEndsAt || ''} disabled={!hour.enabled} onChange={(event) => patchHour(index, { breakEndsAt: event.target.value || null })} />
                </div>
              )
            })}
          </div>
        </Group>

        {message && <Notice role="status">{message}</Notice>}
        <Button type="submit" variant="dark" loading={busy} disabled={saved} className="justify-self-start max-sm:w-full">
          {saved ? <Check aria-hidden="true" /> : <Save aria-hidden="true" />}
          {saved ? 'Configurações salvas' : 'Salvar configurações'}
        </Button>
      </form>

      <form className={cn(cardStyles, 'grid gap-4')} onSubmit={saveLoyalty}>
        <div>
          <Eyebrow>Retenção</Eyebrow>
          <h3 className="flex items-center gap-2 font-serif text-xl font-medium [&_svg]:size-5 [&_svg]:text-brand-deep"><Gift aria-hidden="true" /> Programa de fidelidade</h3>
        </div>
        <Toggle checked={loyaltyForm.enabled} onChange={(checked) => setLoyaltyForm({ ...loyaltyForm, enabled: checked })}>Programa ativo</Toggle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Visitas para ganhar"><Input type="number" min="1" max="100" value={loyaltyForm.requiredVisits} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, requiredVisits: Number(event.target.value) })} required /></Field>
          <Field label="Prêmio"><Input minLength={3} maxLength={160} value={loyaltyForm.rewardDescription} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, rewardDescription: event.target.value })} required /></Field>
        </div>
        <Hint>Cada atendimento concluído (DONE) gera um selo. Cancelamentos, faltas e atendimentos ainda agendados não geram.</Hint>
        {loyaltyMessage && <Notice role="status">{loyaltyMessage}</Notice>}
        <Button type="submit" variant="dark" loading={loyaltyBusy} className="justify-self-start max-sm:w-full">{loyaltyBusy ? 'Salvando…' : 'Salvar fidelidade'}</Button>
      </form>

      <section className={cn(cardStyles, 'grid gap-4')} aria-labelledby="holidays-title">
        <div className="flex items-start justify-between gap-4">
          <div><Eyebrow>Agenda bloqueada</Eyebrow><h3 id="holidays-title" className="font-serif text-xl font-medium">Feriados</h3></div>
          <CalendarOff className="size-5 text-brand-deep" aria-hidden="true" />
        </div>
        <Hint>Nas datas cadastradas, nenhum horário ficará disponível para agendamento.</Hint>
        <form className="grid items-end gap-3 sm:grid-cols-[11rem_1fr_auto]" onSubmit={createHoliday}>
          <Field label="Data"><Input type="date" required value={holidayForm.date} onChange={(event) => setHolidayForm({ ...holidayForm, date: event.target.value })} /></Field>
          <Field label="Descrição"><Input minLength={3} maxLength={80} required placeholder="Ex.: Natal" value={holidayForm.description} onChange={(event) => setHolidayForm({ ...holidayForm, description: event.target.value })} /></Field>
          <Button type="submit" variant="dark" loading={holidayBusy}>Cadastrar feriado</Button>
        </form>
        {holidayMessage && <Notice role="status">{holidayMessage}</Notice>}
        {holidays.length === 0 ? (
          <p className="text-sm text-muted">Nenhum feriado cadastrado.</p>
        ) : (
          <ul className="grid gap-2.5">
            {holidays.map((holiday) => (
              <li className="flex items-center justify-between gap-4 rounded-xl border border-line p-3" key={holiday.id}>
                <div className="grid gap-0.5"><strong>{formatHolidayDate(holiday.date)}</strong><span className="text-sm text-muted">{holiday.description}</span></div>
                <button className="grid size-11 shrink-0 place-items-center rounded-full border border-line text-danger transition hover:border-danger hover:bg-danger-soft focus-visible:ring-4 focus-visible:ring-danger/25 focus-visible:outline-none disabled:opacity-60" aria-label={`Remover ${holiday.description}`} disabled={holidayBusy} onClick={() => {
                  setHolidayDeleteError(null)
                  setHolidayTarget(holiday)
                }} type="button"><Trash2 className="size-[1.1rem]" aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
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

function BillingCard({ icon, label, value, children }: { icon: React.ReactNode; label: string; value: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="grid content-start gap-2 rounded-2xl border border-line bg-surface p-5 text-sm text-muted [&_svg]:size-5 [&_svg]:text-brand-deep">
      {icon}
      <span className="text-[.68rem] font-extrabold tracking-wide uppercase">{label}</span>
      <strong className="font-serif text-2xl font-medium text-ink">{value}</strong>
      {children}
    </article>
  )
}
