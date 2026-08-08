import type { AppointmentStatus } from '../types'

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

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`status status-${status.toLowerCase()}`}>{labels[status]}</span>
}
