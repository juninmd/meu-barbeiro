import type { AppointmentStatus } from '../types'

const labels: Record<AppointmentStatus, string> = {
  PENDING: 'Aguardando',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
  DONE: 'Concluído',
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`status status-${status.toLowerCase()}`}>{labels[status]}</span>
}
