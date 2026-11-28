import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage, repository } from '../lib/repository'
import type { Appointment, MyReview } from '../types'
import { Alert, TextField } from '@juninmd/sonido'
import { Button } from './ui/Button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/Dialog'
import { StarInput } from './ui/Stars'

interface Props {
  appointment: Appointment
  onClose: () => void
  onSubmitted: (review: MyReview) => void
}

/** Pesquisa de satisfação: nota de 1 a 5 e comentário opcional sobre um atendimento concluído. */
export function ReviewDialog({ appointment, onClose, onSubmitted }: Props) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (rating < 1) { setError('Escolha uma nota de 1 a 5 estrelas.'); return }
    setBusy(true)
    setError(null)
    try {
      const review = await repository.submitReview({ appointmentId: appointment.id, rating, ...(comment.trim() ? { comment: comment.trim() } : {}) })
      toast.success('Obrigado pela avaliação!')
      onSubmitted(review)
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível enviar a avaliação.'))
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent>
        <p className="mb-2 text-[.72rem] font-extrabold tracking-[.16em] text-brand-deep uppercase">Pesquisa de satisfação</p>
        <DialogTitle className="mb-1 font-serif text-3xl leading-tight font-medium tracking-tight">Como foi seu atendimento?</DialogTitle>
        <DialogDescription className="mb-4 text-muted">{appointment.service.name} com {appointment.barber.name}</DialogDescription>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <StarInput value={rating} onChange={(value) => { setRating(value); setError(null) }} name="Nota do atendimento" />
          <TextField
            multiline
            rows={3}
            label="Comentário (opcional)"
            hint={`${comment.length}/500`}
            maxLength={500}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="O que você mais gostou? O que podemos melhorar?"
          />
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2.5 max-sm:flex-col-reverse [&>button]:max-sm:w-full">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Agora não</Button>
            <Button type="submit" loading={busy}>Enviar avaliação</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
