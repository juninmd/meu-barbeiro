import { useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { formatCurrency } from '../../lib/format'
import type { Appointment } from '../../types'

const weekdayShort = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const hours = Array.from({ length: 12 }, (_, index) => index + 9)
const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

interface Bar { label: string; value: number; title: string }

/** Faturamento por dia ou semana e mapa de ocupação dia × hora, calculados da agenda carregada. */
export function InsightsPanel({ appointments }: { appointments: Appointment[] }) {
  const [range, setRange] = useState<'week' | 'month'>('week')

  const data = useMemo(() => {
    const done = appointments.filter((item) => item.status === 'DONE')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const revenueByDay = new Map<string, number>()
    done.forEach((item) => {
      const key = dayKey(new Date(item.scheduledAt))
      revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + item.service.price)
    })

    const week: Bar[] = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() - 6 + index)
      const value = revenueByDay.get(dayKey(date)) ?? 0
      return { label: index === 6 ? 'hoje' : weekdayShort[date.getDay()]!, value, title: `${date.toLocaleDateString('pt-BR')}: ${formatCurrency(value)}` }
    })
    const month: Bar[] = Array.from({ length: 4 }, (_, index) => {
      let value = 0
      for (let offset = 0; offset < 7; offset += 1) {
        const date = new Date(today)
        date.setDate(today.getDate() - (3 - index) * 7 - offset)
        value += revenueByDay.get(dayKey(date)) ?? 0
      }
      return { label: index === 3 ? 'esta' : `−${3 - index} sem`, value, title: `${index === 3 ? 'Últimos 7 dias' : `${3 - index} semana(s) atrás`}: ${formatCurrency(value)}` }
    })

    const occupancy = new Map<string, number>()
    appointments.filter((item) => item.status !== 'CANCELLED').forEach((item) => {
      const date = new Date(item.scheduledAt)
      const key = `${date.getDay()}-${date.getHours()}`
      occupancy.set(key, (occupancy.get(key) ?? 0) + 1)
    })
    const heatMax = Math.max(1, ...occupancy.values())
    const closed = appointments.filter((item) => item.status === 'DONE' || item.status === 'NO_SHOW')
    const noShows = closed.filter((item) => item.status === 'NO_SHOW').length

    return {
      week,
      month,
      occupancy,
      heatMax,
      ticket: done.length ? done.reduce((sum, item) => sum + item.service.price, 0) / done.length : 0,
      noShowRate: closed.length ? noShows / closed.length : 0,
      customers: new Set(appointments.map((item) => item.userId)).size,
      showSunday: [...occupancy.keys()].some((key) => key.startsWith('0-')),
    }
  }, [appointments])

  const bars = range === 'week' ? data.week : data.month
  const total = bars.reduce((sum, bar) => sum + bar.value, 0)
  const max = Math.max(1, ...bars.map((bar) => bar.value))
  const days = data.showSunday ? [1, 2, 3, 4, 5, 6, 0] : [1, 2, 3, 4, 5, 6]

  return (
    <div className="grid gap-4 lg:grid-cols-6" data-testid="insights">
      <section className="grid animate-fade-up gap-4 rounded-[1.4rem] border border-line bg-surface p-5 shadow-card lg:col-span-4" aria-labelledby="revenue-chart-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="revenue-chart-title" className="font-mono text-[.68rem] font-semibold tracking-[.14em] text-muted uppercase">Faturamento concluído</h2>
          <div className="inline-flex gap-0.5 rounded-xl bg-surface-2 p-1" role="group" aria-label="Período do gráfico">
            {(['week', 'month'] as const).map((value) => (
              <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)} className={cn('min-h-9 rounded-lg px-3 font-mono text-[.7rem] font-semibold transition', range === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>
                {value === 'week' ? '7 dias' : '4 semanas'}
              </button>
            ))}
          </div>
        </div>
        <strong className="font-serif text-4xl leading-none font-medium tabular-nums">{formatCurrency(total)}</strong>
        <div className="grid h-44 items-end gap-2 border-b border-line bg-[linear-gradient(var(--line)_1px,transparent_1px)] bg-[length:100%_44px] bg-[position:0_20px] pt-5 sm:gap-3" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }} role="img" aria-label={bars.map((bar) => bar.title).join('; ')} key={range}>
          {bars.map((bar, index) => {
            const top = bar.value === max && bar.value > 0
            return (
              <div key={bar.label} title={bar.title} className="group relative h-full">
                <span
                  className={cn('absolute inset-x-0 bottom-0 origin-bottom rounded-t-lg rounded-b-sm transition-colors motion-safe:animate-[grow_.9s_cubic-bezier(.22,1,.36,1)_both]', top ? 'bg-brand' : 'bg-brand/30 group-hover:bg-brand/60')}
                  style={{ height: `${Math.max(2, (bar.value / max) * 100)}%`, animationDelay: `${index * 60}ms` }}
                />
                <span className={cn('absolute inset-x-0 text-center font-mono text-[.6rem] font-semibold whitespace-nowrap', top ? 'text-ink' : 'text-muted')} style={{ bottom: `calc(${Math.max(2, (bar.value / max) * 100)}% + 4px)` }}>
                  {bar.value >= 1000 ? `${(bar.value / 1000).toFixed(1).replace('.', ',')}k` : bar.value || ''}
                </span>
              </div>
            )
          })}
        </div>
        <div className="grid gap-2 text-center font-mono text-[.64rem] text-muted sm:gap-3" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }} aria-hidden="true">
          {bars.map((bar) => <span key={bar.label}>{bar.label}</span>)}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-1">
        <Kpi label="Ticket médio" value={formatCurrency(data.ticket)} hint="por atendimento concluído" />
        <Kpi label="Faltas" value={`${Math.round(data.noShowRate * 100)}%`} hint="dos atendimentos encerrados" alert={data.noShowRate > 0.1} />
        <Kpi label="Clientes" value={String(data.customers)} hint="na agenda carregada" />
      </div>

      <section className="grid animate-fade-up gap-3 rounded-[1.4rem] border border-line bg-surface p-5 shadow-card lg:col-span-6" aria-labelledby="occupancy-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="occupancy-title" className="font-mono text-[.68rem] font-semibold tracking-[.14em] text-muted uppercase">Ocupação por horário</h2>
          <span className="flex items-center gap-2 text-xs text-muted">baixa <span className="h-2 w-10 rounded-full bg-linear-to-r from-surface-3 to-brand" aria-hidden="true" /> alta</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-separate border-spacing-0.5 font-mono text-[.56rem] text-muted sm:border-spacing-1 sm:text-[.62rem]">
            <caption className="sr-only">Quantidade de horários marcados por dia da semana e hora</caption>
            <thead><tr><th scope="col" className="w-9"><span className="sr-only">Dia</span></th>{hours.map((hour) => <th scope="col" key={hour} className="font-semibold">{hour}h</th>)}</tr></thead>
            <tbody>
              {days.map((day) => (
                <tr key={day}>
                  <th scope="row" className="pr-1 text-left font-semibold">{weekdayShort[day]}</th>
                  {hours.map((hour) => {
                    const count = data.occupancy.get(`${day}-${hour}`) ?? 0
                    return (
                      <td key={hour} title={`${weekdayShort[day]} ${hour}h: ${count} horário(s)`} className="h-7 rounded-md transition hover:scale-110" style={{ background: `color-mix(in oklab, var(--amber) ${Math.round((count / data.heatMax) * 100)}%, var(--surface-3))` }}>
                        <span className="sr-only">{count}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Kpi({ label, value, hint, alert }: { label: string; value: string; hint: string; alert?: boolean }) {
  return (
    <article className={cn('grid animate-fade-up content-center gap-1 rounded-[1.4rem] border p-4 shadow-card', alert ? 'border-warn/40 bg-warn-soft' : 'border-line bg-surface')}>
      <span className="font-mono text-[.64rem] font-semibold tracking-[.12em] text-muted uppercase">{label}</span>
      <strong className={cn('font-serif text-3xl leading-none font-medium tabular-nums', alert && 'text-warn')}>{value}</strong>
      <small className="text-xs text-muted">{hint}</small>
    </article>
  )
}
