export type Role = 'BARBER' | 'CUSTOMER'

export interface User {
  id: string
  name: string
  email?: string
  role: Role
}

export interface Barber extends User {
  role: 'BARBER'
  specialty: string
}

export interface Service {
  id: string
  name: string
  duration: number
  price: number
}

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'DONE'

export interface Appointment {
  id: string
  userId: string
  barberId: string
  serviceId: string
  scheduledAt: string
  status: AppointmentStatus
  user: User
  barber: Barber
  service: Service
}

export interface NewAppointment {
  barberId: string
  serviceId: string
  scheduledAt: string
}

export interface NewService {
  name: string
  duration: number
  price: number
}
