import { CalendarRange, CircleDollarSign, PackageCheck, Scissors, TrendingDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { Barbershop, RevenueReport } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Notice, SectionHeading, StatTile } from '../../components/ui/Notice'
import { cardStyles } from '../../components/ui/Card'
import { cn } from '../../lib/cn'

interface DailyClosingProps {
  barbershop: Barbershop
}

const money = (cents: number) => formatCurrency(cents / 100)

const todayInTimezone = (timezone: string) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function DailyClosing({ barbershop }: DailyClosingProps) {
  const today = todayInTimezone(barbershop.timezone)
  const [range, setRange] = useState({ from: today, to: today })
  const [report, setReport] = useState<RevenueReport | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async (from: string, to: string) => {
    setBusy(true)
    setMessage(null)
    try {
      setReport(await repository.report(from, to))
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível fechar o período'))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void load(today, today) }, [today])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (range.from > range.to) {
      setMessage('A data inicial deve ser anterior à data final.')
      return
    }
    void load(range.from, range.to)
  }

  return (
    <section className={cn(cardStyles, 'grid gap-5')} aria-labelledby="closing-title">
      <SectionHeading
        eyebrow="Caixa realizado" title="Fechamento" id="closing-title"
        aside={(
          <form className="flex w-full flex-wrap items-end gap-3 sm:w-auto" onSubmit={submit}>
            <label className="grid flex-1 gap-1 text-[.66rem] font-extrabold tracking-wide text-muted uppercase">De<Input aria-label="Início do fechamento" type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} required /></label>
            <label className="grid flex-1 gap-1 text-[.66rem] font-extrabold tracking-wide text-muted uppercase">Até<Input aria-label="Fim do fechamento" type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} required /></label>
            <Button type="submit" variant="dark" loading={busy} className="max-sm:w-full"><CalendarRange aria-hidden="true" /> {busy ? 'Fechando…' : 'Consultar'}</Button>
          </form>
        )}
      />
      {message && <Notice tone="danger" role="alert">{message}</Notice>}
      {report && (
        <>
          <Notice><strong>Caixa, não previsão:</strong> {report.notice} Fuso: {report.period.timezone}.</Notice>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={<CircleDollarSign />} label="Receita bruta" value={money(report.totals.grossRevenueCents)} />
            <StatTile icon={<TrendingDown />} label="Comissão da plataforma" value={`− ${money(report.totals.platformCommissionCents)}`} />
            <StatTile icon={<CircleDollarSign />} label="Recebimento líquido" value={money(report.totals.netRevenueCents)} featured />
            <StatTile icon={<Scissors />} label="Ticket médio de serviços" value={money(report.averageTicketCents)} />
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-muted [&>span]:rounded-lg [&>span]:bg-surface-3 [&>span]:px-3 [&>span]:py-2 [&_strong]:text-ink">
            <span><strong>{report.totals.completedAppointments}</strong> atendimentos concluídos</span>
            <span><strong>{report.noShows}</strong> faltas</span>
            <span><strong>{report.cancellations}</strong> cancelamentos</span>
          </div>
          <div className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
            {report.byBarber.map((item) => (
              <article className="rounded-xl border border-line bg-field p-4" key={item.barber.id}>
                <h3 className="mb-3 font-serif text-lg font-medium">{item.barber.name}</h3>
                <dl className="grid gap-1.5 text-sm">
                  <Row label="Atendimentos DONE" value={String(item.completedAppointments)} />
                  <Row label="Serviços" value={money(item.serviceRevenueCents)} />
                  <Row label="Produtos vendidos" value={String(item.productsSold)} />
                  <Row label="Receita de produtos" value={money(item.productRevenueCents)} />
                  <Row label="Comissão da plataforma" value={`− ${money(item.platformCommissionCents)}`} />
                  <Row label="Líquido" value={money(item.netRevenueCents)} strong />
                </dl>
              </article>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Ranking title="Serviços mais vendidos" icon={<Scissors />} items={report.topServices} />
            <Ranking title="Produtos mais vendidos" icon={<PackageCheck />} items={report.topProducts} />
          </div>
        </>
      )}
    </section>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-4 border-b border-line pb-1.5 last:border-0', strong && 'pt-1')}>
      <dt className="text-muted">{label}</dt>
      <dd className={cn('font-bold tabular-nums', strong && 'text-brand-deep')}>{value}</dd>
    </div>
  )
}

function Ranking({ title, icon, items }: { title: string; icon: React.ReactNode; items: RevenueReport['topServices'] }) {
  return (
    <section className="rounded-xl bg-surface-3 p-4">
      <h3 className="mb-3 flex items-center gap-2 font-serif text-base font-medium [&_svg]:size-4 [&_svg]:text-brand-deep">{icon}{title}</h3>
      {items.length === 0 ? <p className="text-sm text-muted">Sem vendas no período.</p> : (
        <ol className="grid gap-1.5 text-sm">
          {items.slice(0, 5).map((item, index) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3"><span><span className="mr-2 text-muted tabular-nums">{index + 1}.</span>{item.name}</span><strong className="tabular-nums">{item.quantity} · {money(item.revenueCents)}</strong></li>
          ))}
        </ol>
      )}
    </section>
  )
}
