import { MessageSquareHeart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Skeleton } from '../../components/ui/Skeleton'
import { Stars } from '../../components/ui/Stars'
import { errorMessage, repository } from '../../lib/repository'
import type { ReviewsOverview } from '../../types'

const dateLabel = (value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value))

/** Resultado da pesquisa de satisfação: nota média, distribuição e últimas avaliações. */
export function ReviewsPanel() {
  const [data, setData] = useState<ReviewsOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    repository.reviewsOverview().then((value) => active && setData(value)).catch((caught) => active && setError(errorMessage(caught, 'Não foi possível carregar as avaliações.')))
    return () => { active = false }
  }, [])

  return (
    <Card as="section" aria-labelledby="reviews-title" className="grid gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 flex items-center gap-2 text-[.72rem] font-extrabold tracking-[.18em] text-brand-deep uppercase"><MessageSquareHeart className="size-4" aria-hidden="true" /> Pesquisa de satisfação</p>
          <h2 id="reviews-title" className="font-serif text-2xl font-medium tracking-tight">Avaliações dos clientes</h2>
        </div>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-danger-ink">{error}</p>}
      {!data && !error && <div className="grid gap-3"><Skeleton className="h-24" /><Skeleton className="h-16" /></div>}
      {data && data.summary.count === 0 && <p className="text-muted">Nenhuma avaliação ainda. Depois de concluir um atendimento, o cliente é convidado a avaliar em &quot;Meus horários&quot;.</p>}
      {data && data.summary.count > 0 && (
        <>
          <div className="grid items-center gap-5 rounded-2xl bg-surface-2 p-5 sm:grid-cols-[auto_1fr]">
            <div className="text-center"><strong className="block font-serif text-5xl leading-none tabular-nums">{data.summary.average.toFixed(1)}</strong><Stars value={data.summary.average} className="mt-2" /><small className="mt-1 block text-muted">{data.summary.count} {data.summary.count === 1 ? 'avaliação' : 'avaliações'}</small></div>
            <ul className="grid gap-1.5" aria-label="Distribuição das notas">
              {([5, 4, 3, 2, 1] as const).map((star) => (
                <li key={star} className="flex items-center gap-2 text-xs text-muted">
                  <span className="w-3 text-right tabular-nums">{star}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-paper-deep"><span className="block h-full rounded-full bg-brand" style={{ width: `${(data.summary.distribution[star] / data.summary.count) * 100}%` }} /></span>
                  <span className="w-5 tabular-nums">{data.summary.distribution[star]}</span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="grid gap-3">
            {data.reviews.map((review) => (
              <li key={review.id} className="rounded-2xl border border-line p-4">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><strong>{review.customerName}</strong><Stars value={review.rating} /></div>
                <p className="mb-2 text-xs text-muted">{review.serviceName} · {review.barberName} · {dateLabel(review.createdAt)}</p>
                {review.comment && <p className="text-sm leading-relaxed text-ink/80">{review.comment}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
