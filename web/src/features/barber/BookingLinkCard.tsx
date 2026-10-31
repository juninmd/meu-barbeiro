import { Copy, Download, ExternalLink, MessageCircle, QrCode } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useRef } from 'react'
import { toast } from 'sonner'
import { Button, buttonStyles } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { cn } from '../../lib/cn'
import type { Barbershop } from '../../types'

/** Link público de agendamento: copiar, enviar por WhatsApp e QR Code para imprimir e colar no balcão. */
export function BookingLinkCard({ barbershop }: { barbershop: Barbershop }) {
  const canvas = useRef<HTMLDivElement>(null)
  const link = `${window.location.origin}/b/${barbershop.slug}`
  const text = `Agende seu horário na ${barbershop.name}: ${link}`

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast.success('Link copiado.') } catch { toast.error('Não foi possível copiar. Selecione o endereço e copie manualmente.') }
  }

  const download = () => {
    const element = canvas.current?.querySelector('canvas')
    if (!element) return
    const anchor = document.createElement('a')
    anchor.href = element.toDataURL('image/png')
    anchor.download = `qr-${barbershop.slug}.png`
    anchor.click()
  }

  return (
    <Card as="section" aria-labelledby="booking-link-title" className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
      <div className="grid gap-4">
        <div>
          <p className="mb-1 flex items-center gap-2 text-[.72rem] font-extrabold tracking-[.18em] text-brand-deep uppercase"><QrCode className="size-4" aria-hidden="true" /> Divulgação</p>
          <h2 id="booking-link-title" className="font-serif text-2xl font-medium tracking-tight">Seu link de agendamento</h2>
          <p className="mt-1 text-muted">Página pública com serviços, equipe, horários e avaliações. O cliente agenda sem precisar de ligação.</p>
        </div>
        <input readOnly aria-label="Link de agendamento" value={link} onFocus={(event) => event.currentTarget.select()} className="min-h-12 w-full rounded-xl border border-control bg-field px-3.5 text-sm" />
        <div className="flex flex-wrap gap-2.5">
          <Button variant="dark" size="sm" onClick={copy}><Copy aria-hidden="true" /> Copiar link</Button>
          <a className={cn(buttonStyles({ variant: 'ghost', size: 'sm' }))} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" /> Enviar por WhatsApp</a>
          <a className={cn(buttonStyles({ variant: 'ghost', size: 'sm' }))} href={link} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" /> Ver página</a>
        </div>
      </div>
      <div ref={canvas} className="grid justify-items-center gap-3">
        <div className="rounded-2xl border border-line bg-white p-3 shadow-sm"><QRCodeCanvas value={link} size={148} marginSize={0} title={`QR Code para ${link}`} /></div>
        <Button variant="ghost" size="sm" onClick={download}><Download aria-hidden="true" /> Baixar QR Code</Button>
      </div>
    </Card>
  )
}
