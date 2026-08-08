import { useEffect, useState } from 'react'
import { formatCurrency } from '../../lib/format'
import { errorMessage, repository } from '../../lib/repository'
import type { CancellationReport } from '../../types'

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
    <section className="panel" aria-labelledby="cancellations-title">
      <div className="section-heading"><div><p className="eyebrow">Perdas e retenção</p><h2 id="cancellations-title">Cancelamentos</h2></div></div>
      <div className="form-row">
        <label>De<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Até<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      {message && <p className="form-message" role="alert">{message}</p>}
      {report && (
        <>
          <div className="metric-grid">
            <article className="metric"><div><span>Total</span><strong>{report.total}</strong><small>{report.byTiming.late} em cima da hora · {report.byTiming.advance} com antecedência</small></div></article>
            <article className="metric"><div><span>Faturamento perdido</span><strong>{formatCurrency(report.lostRevenueCents / 100)}</strong><small>Soma dos serviços cancelados</small></div></article>
            <article className="metric"><div><span>Taxa retida</span><strong>{formatCurrency(report.retainedFeeCents / 100)}</strong><small>{report.waitlistReused} horário(s) reaproveitado(s) pela fila</small></div></article>
          </div>
          <div className="settings-columns">
            <div><h3>Quem cancelou</h3><p>Cliente: {report.byCancelledBy.CUSTOMER} · Barbeiro: {report.byCancelledBy.BARBER} · Dono: {report.byCancelledBy.OWNER} · Admin: {report.byCancelledBy.ADMIN}</p></div>
            <div><h3>Clientes que mais cancelam</h3>{report.topCustomers.length ? report.topCustomers.slice(0, 5).map((item) => <p key={item.id}>{item.name}: {item.cancellations}</p>) : <p>Nenhum no período.</p>}</div>
            <div><h3>Agenda mais afetada</h3><p>Dias: {report.byWeekday.slice(0, 3).map((item) => `${item.label} (${item.cancellations})`).join(', ') || 'sem dados'}</p><p>Horários: {report.byHour.slice(0, 3).map((item) => `${item.label} (${item.cancellations})`).join(', ') || 'sem dados'}</p></div>
          </div>
        </>
      )}
    </section>
  )
}
