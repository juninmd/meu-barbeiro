import { useEffect, useState } from 'react'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { CancellationReport } from '../../types'
import { cardStyles } from '../../components/ui/Card'
import { Input } from '../../components/ui/Field'
import { Notice, SectionHeading, StatTile } from '../../components/ui/Notice'
import { cn } from '../../lib/cn'

const dateInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function CancellationReportPanel() {
  const today = new Date()
  const [from, setFrom] = useState(dateInput(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [to, setTo] = useState(dateInput(today))
  const [report, setReport] = useState<CancellationReport | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setMessage(null)
    repository.cancellationReport(from, to)
      .then((value) => { if (active) setReport(value) })
      .catch((error) => { if (active) setMessage(errorMessage(error, 'Não foi possível carregar os cancelamentos')) })
    return () => { active = false }
  }, [from, to])

  return (
    <section className={cn(cardStyles, 'grid gap-5')} aria-labelledby="cancellations-title">
      <SectionHeading eyebrow="Perdas e retenção" title="Cancelamentos" id="cancellations-title" />
      <div className="grid gap-3 sm:max-w-md sm:grid-cols-2">
        <label className="grid gap-1 text-[.66rem] font-extrabold tracking-wide text-muted uppercase">De<Input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="grid gap-1 text-[.66rem] font-extrabold tracking-wide text-muted uppercase">Até<Input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      {message && <Notice tone="danger" role="alert">{message}</Notice>}
      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Total" value={String(report.total)} hint={`${report.byTiming.late} em cima da hora · ${report.byTiming.advance} com antecedência`} />
            <StatTile label="Faturamento perdido" value={formatCurrency(report.lostRevenueCents / 100)} hint="Soma dos serviços cancelados" />
            <StatTile label="Taxa retida" value={formatCurrency(report.retainedFeeCents / 100)} hint={`${report.waitlistReused} horário(s) reaproveitado(s) pela fila`} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Insight title="Quem cancelou"><p>Cliente: {report.byCancelledBy.CUSTOMER} · Barbeiro: {report.byCancelledBy.BARBER} · Dono: {report.byCancelledBy.OWNER} · Admin: {report.byCancelledBy.ADMIN}</p></Insight>
            <Insight title="Clientes que mais cancelam">{report.topCustomers.length ? report.topCustomers.slice(0, 5).map((item) => <p key={item.id}>{item.name}: {item.cancellations}</p>) : <p>Nenhum no período.</p>}</Insight>
            <Insight title="Agenda mais afetada"><p>Dias: {report.byWeekday.slice(0, 3).map((item) => `${item.label} (${item.cancellations})`).join(', ') || 'sem dados'}</p><p>Horários: {report.byHour.slice(0, 3).map((item) => `${item.label} (${item.cancellations})`).join(', ') || 'sem dados'}</p></Insight>
          </div>
        </>
      )}
    </section>
  )
}

function Insight({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1 rounded-xl border border-line bg-surface-2 p-4 text-sm text-muted">
      <h3 className="mb-1 font-serif text-base font-medium text-ink">{title}</h3>
      {children}
    </div>
  )
}
