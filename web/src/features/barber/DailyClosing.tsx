import { CalendarRange, CircleDollarSign, PackageCheck, Scissors, TrendingDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { Barbershop, RevenueReport } from '../../types'

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
    <section className="panel closing-panel" aria-labelledby="closing-title">
      <div className="section-heading closing-heading">
        <div><p className="eyebrow">Caixa realizado</p><h2 id="closing-title">Fechamento</h2></div>
        <form className="closing-range" onSubmit={submit}>
          <label>De<input aria-label="Início do fechamento" type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} required /></label>
          <label>Até<input aria-label="Fim do fechamento" type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} required /></label>
          <button className="button button-dark" disabled={busy}><CalendarRange aria-hidden="true" /> {busy ? 'Fechando…' : 'Consultar'}</button>
        </form>
      </div>
      {message && <p className="form-message" role="alert">{message}</p>}
      {report && (
        <>
          <p className="cash-notice"><strong>Caixa, não previsão:</strong> {report.notice} Fuso: {report.period.timezone}.</p>
          <div className="closing-totals">
            <ClosingMetric icon={<CircleDollarSign />} label="Receita bruta" value={money(report.totals.grossRevenueCents)} />
            <ClosingMetric icon={<TrendingDown />} label="Comissão da plataforma" value={`− ${money(report.totals.platformCommissionCents)}`} />
            <ClosingMetric icon={<CircleDollarSign />} label="Recebimento líquido" value={money(report.totals.netRevenueCents)} featured />
            <ClosingMetric icon={<Scissors />} label="Ticket médio de serviços" value={money(report.averageTicketCents)} />
          </div>
          <div className="closing-events">
            <span><strong>{report.totals.completedAppointments}</strong> atendimentos concluídos</span>
            <span><strong>{report.noShows}</strong> faltas</span>
            <span><strong>{report.cancellations}</strong> cancelamentos</span>
          </div>
          <div className="barber-report-list">
            {report.byBarber.map((item) => (
              <article className="barber-report" key={item.barber.id}>
                <h3>{item.barber.name}</h3>
                <dl>
                  <div><dt>Atendimentos DONE</dt><dd>{item.completedAppointments}</dd></div>
                  <div><dt>Serviços</dt><dd>{money(item.serviceRevenueCents)}</dd></div>
                  <div><dt>Produtos vendidos</dt><dd>{item.productsSold}</dd></div>
                  <div><dt>Receita de produtos</dt><dd>{money(item.productRevenueCents)}</dd></div>
                  <div><dt>Comissão da plataforma</dt><dd>− {money(item.platformCommissionCents)}</dd></div>
                  <div className="report-net"><dt>Líquido</dt><dd>{money(item.netRevenueCents)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <div className="ranking-grid">
            <Ranking title="Serviços mais vendidos" icon={<Scissors />} items={report.topServices} />
            <Ranking title="Produtos mais vendidos" icon={<PackageCheck />} items={report.topProducts} />
          </div>
        </>
      )}
    </section>
  )
}

function ClosingMetric({ icon, label, value, featured = false }: { icon: React.ReactNode; label: string; value: string; featured?: boolean }) {
  return <article className={`closing-metric ${featured ? 'featured' : ''}`}><span>{icon}{label}</span><strong>{value}</strong></article>
}

function Ranking({ title, icon, items }: { title: string; icon: React.ReactNode; items: RevenueReport['topServices'] }) {
  return (
    <section className="ranking-card"><h3>{icon}{title}</h3>{items.length === 0 ? <p>Sem vendas no período.</p> : (
      <ol>{items.slice(0, 5).map((item) => <li key={item.id}><span>{item.name}</span><strong>{item.quantity} · {money(item.revenueCents)}</strong></li>)}</ol>
    )}</section>
  )
}
