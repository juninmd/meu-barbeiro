import type { AppointmentStatus } from '../types'
import { Badge } from './ui/Badge'

type Status = AppointmentStatus | 'ACTIVE' | 'INACTIVE'

const labels: Record<Status, string> = {
  PENDING: 'Aguardando',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
  DONE: 'Concluído',
  NO_SHOW: 'Faltou',
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
}

const tones = {
  PENDING: 'warning', CONFIRMED: 'success', CANCELLED: 'danger', DONE: 'neutral', NO_SHOW: 'danger', ACTIVE: 'success', INACTIVE: 'neutral',
} as const

export function StatusBadge({ status }: { status: Status }) {
  return <Badge tone={tones[status]} dot>{labels[status]}</Badge>
}
