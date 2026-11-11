import { ArrowRight, Check } from 'lucide-react'
import { useRef, useState } from 'react'
import { cn } from '../../lib/cn'

interface SwipeActionProps {
  label: string
  /** Nome acessível do botão (ex.: "Concluir atendimento de João"). */
  actionLabel: string
  onComplete: () => void | Promise<void>
  disabled?: boolean
  className?: string
}

/**
 * Deslize para confirmar: evita toque acidental na bancada.
 * Teclado e leitores de tela ativam o botão normalmente (Enter, Espaço ou toque duplo do leitor).
 */
export function SwipeAction({ label, actionLabel, onComplete, disabled, className }: SwipeActionProps) {
  const track = useRef<HTMLDivElement>(null)
  const start = useRef<number | null>(null)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState(false)

  const max = () => Math.max(0, (track.current?.clientWidth ?? 0) - 56)

  const finish = async () => {
    if (done || disabled) return
    setOffset(max())
    setDone(true)
    try {
      await onComplete()
    } finally {
      window.setTimeout(() => { setDone(false); setOffset(0) }, 400)
    }
  }

  return (
    <div
      ref={track}
      className={cn('relative h-14 touch-none overflow-hidden rounded-[18px] bg-paper/15 select-none', disabled && 'opacity-50', className)}
    >
      <span
        className={cn('absolute inset-y-0 left-0 rounded-[18px] bg-brand', !dragging && 'transition-[width] duration-500 ease-[cubic-bezier(.34,1.56,.64,1)]')}
        style={{ width: done ? '100%' : offset + 56 }}
        aria-hidden="true"
      />
      <span className="pointer-events-none absolute inset-0 grid place-items-center pl-12 text-sm font-semibold opacity-85" aria-hidden="true">
        <span className="motion-safe:animate-[nudge_2.4s_ease-in-out_infinite]">{hint ? 'Arraste até o fim' : label} →</span>
      </span>
      <button
        type="button"
        aria-label={actionLabel}
        disabled={disabled || done}
        className={cn('absolute top-1 left-1 z-10 grid size-12 cursor-grab place-items-center rounded-[14px] bg-paper text-ink shadow-md active:cursor-grabbing disabled:cursor-wait', !dragging && 'transition-transform duration-500 ease-[cubic-bezier(.34,1.56,.64,1)]')}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(event) => {
          if (disabled || done) return
          start.current = event.clientX
          setDragging(true)
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (start.current === null) return
          setOffset(Math.max(0, Math.min(max(), event.clientX - start.current)))
        }}
        onPointerUp={(event) => {
          if (start.current === null) return
          const moved = event.clientX - start.current
          start.current = null
          setDragging(false)
          if (moved >= max() * 0.82) void finish()
          else {
            setOffset(0)
            if (Math.abs(moved) < 6) { setHint(true); window.setTimeout(() => setHint(false), 1600) }
          }
        }}
        onPointerCancel={() => { start.current = null; setDragging(false); setOffset(0) }}
        onClick={(event) => {
          // detail === 0: ativação por teclado ou leitor de tela, que não arrastam.
          if (event.detail === 0) void finish()
        }}
      >
        {done ? <Check className="size-5 animate-pop" aria-hidden="true" /> : <ArrowRight className="size-5" aria-hidden="true" />}
      </button>
    </div>
  )
}

/** Anel de progresso animado (meta do dia, ocupação). */
export function ProgressRing({ value, size = 92, stroke = 9, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="!size-full -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-surface-3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="stroke-brand transition-[stroke-dashoffset] duration-1000 ease-[cubic-bezier(.22,1,.36,1)] motion-safe:animate-[ring-in_1.2s_cubic-bezier(.22,1,.36,1)]"
          style={{ strokeDasharray: circumference, strokeDashoffset: circumference * (1 - clamped), '--ring-from': circumference } as React.CSSProperties}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  )
}
