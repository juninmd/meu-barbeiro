import { CalendarPlus, Stamp, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buttonStyles } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { cn } from '../../lib/cn'
import { formatCurrency, formatDate } from '../../lib/format'
import { repository } from '../../lib/repository'
import type { Appointment, LoyaltyCard } from '../../types'

const icsDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** Arquivo .ics do horário para o cliente salvar no calendário do celular. */
export function calendarFile(appointment: Appointment, barbershopName = 'Barbearia') {
  const start = new Date(appointment.scheduledAt)
  const end = new Date(start.getTime() + appointment.service.duration * 60_000)
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Meu Barbeiro//PT-BR', 'BEGIN:VEVENT',
    `UID:${appointment.id}@meu-barbeiro`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${appointment.service.name} · ${barbershopName}`, `DESCRIPTION:Com ${appointment.barber.name}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`
}

/** Tíquete de confirmação: check desenhado, resumo destacável e o próximo selo do cartão fidelidade. */
export function BookingTicket({ appointment, barbershopName, onDismiss }: { appointment: Appointment; barbershopName?: string; onDismiss: () => void }) {
  const [card, setCard] = useState<LoyaltyCard | null>(null)

  useEffect(() => {
    let active = true
    repository.loyaltyMe().then((result) => { if (active) setCard(result) }).catch(() => undefined)
    return () => { active = false }
  }, [])

  const program = card?.program?.enabled ? card.program : null
  const filled = program ? Math.min(card!.availableStamps, program.requiredVisits) : 0

  return (
    <section className="relative grid max-w-[820px] animate-fade-up justify-items-center gap-4 overflow-hidden rounded-[1.75rem] border border-line bg-surface p-6 text-center shadow-card sm:p-8" aria-labelledby="ticket-title" data-testid="booking-ticket">
      <button type="button" onClick={onDismiss} className="absolute top-3 right-3 grid size-11 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink" aria-label="Fechar confirmação"><X aria-hidden="true" /></button>
      <svg viewBox="0 0 100 100" className="!size-24" aria-hidden="true">
        <circle cx="50" cy="50" r="45" className="fill-tint stroke-brand [stroke-dasharray:290] [stroke-dashoffset:290] [stroke-width:3] motion-safe:animate-[draw_.7s_cubic-bezier(.22,1,.36,1)_forwards] motion-reduce:[stroke-dashoffset:0]" />
        <path d="M30 52 l14 14 l27 -30" className="fill-none stroke-brand [stroke-dasharray:60] [stroke-dashoffset:60] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:6] motion-safe:animate-[draw_.45s_.55s_cubic-bezier(.22,1,.36,1)_forwards] motion-reduce:[stroke-dashoffset:0]" />
      </svg>
      <div>
        <h2 id="ticket-title" className="font-serif text-3xl font-medium">Cadeira reservada.</h2>
        <p className="text-sm text-muted">O barbeiro já recebeu seu horário{barbershopName ? ` na ${barbershopName}` : ''}.</p>
      </div>
      <div className="grid w-full max-w-md gap-3 rounded-[1.4rem] border border-line bg-surface-2 p-5 text-left motion-safe:animate-[fade-up_.6s_.4s_cubic-bezier(.22,1,.36,1)_both]">
        <div className="flex items-center justify-between gap-3"><Badge tone="success">{appointment.status === 'CONFIRMED' ? 'Confirmado' : 'Enviado'}</Badge><span className="font-mono text-xs text-muted">#{appointment.id.slice(-6).toUpperCase()}</span></div>
        <strong className="font-serif text-2xl font-medium">{appointment.service.name}</strong>
        <span className="text-sm text-muted">com {appointment.barber.name} · {appointment.service.duration} min</span>
        <span className="relative -mx-5 border-t-2 border-dashed border-line before:absolute before:-top-2.5 before:-left-2.5 before:size-5 before:rounded-full before:bg-surface after:absolute after:-top-2.5 after:-right-2.5 after:size-5 after:rounded-full after:bg-surface" aria-hidden="true" />
        <span className="flex items-center justify-between gap-3 font-mono font-semibold"><span className="first-letter:uppercase">{formatDate(appointment.scheduledAt)}</span><span>{formatCurrency(appointment.service.price)}</span></span>
        {program && (
          <>
            <span className="-mx-5 border-t-2 border-dashed border-line" aria-hidden="true" />
            <span className="flex items-center justify-between gap-3 text-sm"><strong>Cartão fidelidade</strong><span className="font-mono text-xs text-muted">{filled}/{program.requiredVisits}</span></span>
            <span className="flex flex-wrap gap-1.5" role="img" aria-label={`${filled} selos de ${program.requiredVisits}; este atendimento vale mais um quando for concluído`}>
              {Array.from({ length: program.requiredVisits }, (_, index) => (
                <span
                  key={index}
                  style={{ animationDelay: `${600 + index * 60}ms` }}
                  className={cn('grid size-7 place-items-center rounded-full border [&_svg]:!size-3.5',
                    index < filled ? 'animate-pop border-brand bg-brand text-on-brand'
                      : index === filled ? 'animate-pop border-brand border-dashed text-brand-deep motion-safe:[animation:pop_.6s_1.2s_cubic-bezier(.34,1.56,.64,1)_both,live_1.4s_1.8s_ease-in-out_infinite]'
                        : 'border-dashed border-line text-muted/50')}
                ><Stamp aria-hidden="true" /></span>
              ))}
            </span>
          </>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        <a className={buttonStyles({ variant: 'primary' })} href={calendarFile(appointment, barbershopName)} download={`horario-${appointment.id.slice(-6)}.ics`}><CalendarPlus aria-hidden="true" /> Adicionar ao calendário</a>
        <Link className={buttonStyles({ variant: 'ghost' })} to="/cliente/perfil">Ver carteira e fidelidade</Link>
      </div>
    </section>
  )
}
