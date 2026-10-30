import { CalendarCheck, Clock3, Copy, MapPin, MessageCircle, PackageOpen, Scissors, Share2, Store, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { Stars } from '../../components/ui/Stars'
import { cn } from '../../lib/cn'
import { formatCurrency } from '../../lib/format'
import { localMoment, openStatus, weekdayName } from '../../lib/hours'
import { errorMessage, repository } from '../../lib/repository'
import type { ShopProfile } from '../../types'

interface Props {
  /** Leva à tela de entrada (criar conta / entrar) para concluir o agendamento. */
  onBook: () => void
  onSignIn: () => void
}

const initials = (name: string) => name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()

export function PublicShop({ onBook, onSignIn }: Props) {
  const [profile, setProfile] = useState<ShopProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    repository.shopProfile()
      .then((value) => active && setProfile(value))
      .catch((caught) => active && setError(errorMessage(caught, 'Não foi possível carregar a barbearia.')))
    return () => { active = false }
  }, [])

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper p-6 text-center">
        <div><h1 className="mb-2 font-serif text-3xl">Barbearia indisponível</h1><p className="mb-5 text-muted">{error}</p><Button onClick={onSignIn}>Entrar</Button></div>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="mx-auto grid min-h-screen max-w-3xl content-start gap-4 bg-paper p-5" aria-busy="true">
        <Skeleton className="h-48" /><Skeleton className="h-24" /><Skeleton className="h-24" /><span className="sr-only" role="status">Carregando a barbearia…</span>
      </main>
    )
  }

  const { barbershop, services, team, rating, reviews, packages } = profile
  const status = openStatus(barbershop.businessHours, barbershop.timezone)
  const today = localMoment(new Date(), barbershop.timezone).weekday
  const link = `${window.location.origin}/b/${barbershop.slug}`
  const mapsUrl = barbershop.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${barbershop.name} ${barbershop.address}`)}` : null
  const shareText = `Agende seu horário na ${barbershop.name}: ${link}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copiado.')
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie o endereço da página.')
    }
  }

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: barbershop.name, text: `Agende seu horário na ${barbershop.name}`, url: link }) } catch { /* cancelado */ }
    } else await copy()
  }

  return (
    <main className="min-h-screen bg-paper pb-28 text-ink" style={{ '--amber': barbershop.primaryColor } as React.CSSProperties}>
      <header className="relative overflow-hidden bg-[radial-gradient(circle_at_85%_-10%,#d99b3250,transparent_45%),linear-gradient(135deg,#15140f,#2b271b)] px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-10 text-chrome-ink sm:px-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-extrabold tracking-[.14em] uppercase"><Scissors className="size-4 text-brand-light" aria-hidden="true" /> Meu Barbeiro</span>
          <button type="button" onClick={onSignIn} className="min-h-11 rounded-full border border-white/25 px-4 text-sm font-bold transition hover:border-brand">Entrar</button>
        </div>
        <div className="mx-auto mt-8 max-w-3xl">
          <div className="mb-4 grid size-16 place-items-center overflow-hidden rounded-2xl border border-white/20 bg-white/10">
            {barbershop.logoUrl ? <img src={barbershop.logoUrl} alt="" className="size-full object-cover" /> : <Store className="size-7 text-brand-light" aria-hidden="true" />}
          </div>
          <h1 className="font-serif text-4xl leading-[1.02] font-medium tracking-tight sm:text-6xl">{barbershop.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-chrome-ink/80">
            {rating.count > 0 && (
              <span className="flex items-center gap-2"><Stars value={rating.average} className="text-brand-light" /><strong className="text-chrome-ink">{rating.average.toFixed(1)}</strong> ({rating.count} {rating.count === 1 ? 'avaliação' : 'avaliações'})</span>
            )}
            <span className="flex items-center gap-1.5"><Clock3 className="size-4" aria-hidden="true" /><Badge tone={status.open ? 'success' : 'neutral'} className="tracking-normal normal-case">{status.open ? 'Aberto' : 'Fechado'}</Badge> {status.label}</span>
            {barbershop.address && <span className="flex items-center gap-1.5"><MapPin className="size-4" aria-hidden="true" />{barbershop.address}</span>}
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button size="lg" onClick={onBook}><CalendarCheck aria-hidden="true" /> Agendar horário</Button>
            <button type="button" onClick={share} className="inline-flex min-h-14 items-center gap-2 rounded-xl border border-white/25 px-5 text-base font-bold transition hover:border-brand"><Share2 className="size-[1.1rem]" aria-hidden="true" /> Compartilhar</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-3xl gap-10 px-5 pt-10 sm:px-10">
        <Section id="servicos" title="Serviços" icon={<Scissors aria-hidden="true" />}>
          {services.length === 0 ? <p className="text-muted">Os serviços serão publicados em breve.</p> : (
            <ul className="grid gap-3">
              {services.map((service) => (
                <li key={service.id} className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm">
                  <div className="min-w-0"><strong className="block">{service.name}</strong><span className="text-sm text-muted">{service.duration} min</span></div>
                  <div className="flex items-center gap-3"><strong className="font-serif text-xl tabular-nums">{formatCurrency(service.price)}</strong><Button size="sm" variant="ghost" onClick={onBook} aria-label={`Agendar ${service.name}`}>Agendar</Button></div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {packages.length > 0 && (
          <Section id="pacotes" title="Pacotes" icon={<PackageOpen aria-hidden="true" />}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {packages.map((item) => (
                <li key={item.id} className="grid gap-1 rounded-2xl border border-brand/40 bg-linear-to-br from-tint to-surface p-4 shadow-sm">
                  <strong>{item.name}</strong>
                  <span className="text-sm text-muted">{item.sessions} sessões · validade {item.validityDays} dias</span>
                  <span className="mt-1 flex items-baseline gap-2"><strong className="font-serif text-2xl tabular-nums">{formatCurrency(item.price)}</strong><small className="text-muted">{formatCurrency(item.price / item.sessions)} por sessão</small></span>
                  <small className="text-muted">Compre na barbearia e use nos próximos atendimentos.</small>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {team.length > 0 && (
          <Section id="equipe" title="Equipe" icon={<UserRound aria-hidden="true" />}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {team.map((member) => (
                <li key={member.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
                  <span className="grid size-12 place-items-center rounded-full bg-linear-to-br from-brand-light to-brand font-extrabold text-[#1c1810]" aria-hidden="true">{initials(member.name)}</span>
                  <div><strong className="block">{member.name}</strong><span className="text-sm text-muted">{member.specialty}</span></div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section id="horarios" title="Horário de funcionamento" icon={<Clock3 aria-hidden="true" />}>
          <ul className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            {[1, 2, 3, 4, 5, 6, 0].map((weekday) => {
              const hour = barbershop.businessHours.find((item) => item.weekday === weekday)
              return (
                <li key={weekday} className={cn('flex items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-0', weekday === today && 'bg-tint font-bold')}>
                  <span className="capitalize">{weekdayName[weekday]}{weekday === today && <span className="ml-2 text-xs font-extrabold tracking-wider text-brand-deep uppercase">hoje</span>}</span>
                  <span className="text-right tabular-nums">
                    {hour?.enabled
                      ? <>{hour.opensAt}–{hour.closesAt}{hour.breakStartsAt && hour.breakEndsAt && <small className="block text-xs font-normal text-muted">almoço {hour.breakStartsAt}–{hour.breakEndsAt}</small>}</>
                      : <span className="text-muted">Fechado</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </Section>

        <Section id="avaliacoes" title="O que dizem os clientes" icon={<MessageCircle aria-hidden="true" />}>
          {rating.count === 0 ? <p className="text-muted">Ainda sem avaliações. Seja o primeiro depois do seu atendimento.</p> : (
            <div className="grid gap-4">
              <div className="grid items-center gap-5 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:grid-cols-[auto_1fr]">
                <div className="text-center"><strong className="block font-serif text-5xl leading-none tabular-nums">{rating.average.toFixed(1)}</strong><Stars value={rating.average} className="mt-2" /><small className="mt-1 block text-muted">{rating.count} {rating.count === 1 ? 'avaliação' : 'avaliações'}</small></div>
                <ul className="grid gap-1.5" aria-label="Distribuição das notas">
                  {([5, 4, 3, 2, 1] as const).map((star) => (
                    <li key={star} className="flex items-center gap-2 text-xs text-muted">
                      <span className="w-3 text-right tabular-nums">{star}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-paper-deep"><span className="block h-full rounded-full bg-brand" style={{ width: `${(rating.distribution[star] / rating.count) * 100}%` }} /></span>
                      <span className="w-5 tabular-nums">{rating.distribution[star]}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <ul className="grid gap-3">
                {reviews.map((review) => (
                  <li key={review.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
                    <div className="mb-1 flex items-center justify-between gap-3"><strong>{review.customerName}</strong><Stars value={review.rating} /></div>
                    <p className="text-sm leading-relaxed text-ink/80">{review.comment}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section id="local" title="Como chegar" icon={<MapPin aria-hidden="true" />}>
          <div className="grid gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <p>{barbershop.address ?? 'Endereço informado no agendamento.'}</p>
            <div className="flex flex-wrap gap-2.5">
              {mapsUrl && <a className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-bold transition hover:border-brand" href={mapsUrl} target="_blank" rel="noreferrer"><MapPin className="size-4" aria-hidden="true" /> Abrir no mapa</a>}
              <a className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-bold transition hover:border-brand" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"><MessageCircle className="size-4" aria-hidden="true" /> Enviar por WhatsApp</a>
              <button type="button" onClick={copy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-bold transition hover:border-brand"><Copy className="size-4" aria-hidden="true" /> Copiar link</button>
            </div>
          </div>
        </Section>

        <footer className="border-t border-line pt-6 text-center text-sm text-muted">
          <p>Agendamento online por <strong>Meu Barbeiro</strong>.</p>
          <button type="button" onClick={onSignIn} className="mt-1 min-h-11 font-bold text-brand-deep underline-offset-4 hover:underline">Sou barbeiro: quero cadastrar minha barbearia</button>
        </footer>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 px-5 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        <Button block size="lg" onClick={onBook}><CalendarCheck aria-hidden="true" /> Agendar horário</Button>
      </div>
    </main>
  )
}

function Section({ id, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4">
      <h2 id={id} className="flex items-center gap-2 font-serif text-2xl font-medium tracking-tight [&_svg]:size-5 [&_svg]:text-brand-deep">{icon}{title}</h2>
      {children}
    </section>
  )
}
