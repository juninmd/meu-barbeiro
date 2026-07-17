export type Role = 'ADMIN' | 'BARBER' | 'CUSTOMER'

export interface User {
  id: string
  name: string
  email?: string
  role: Role
}

export interface Barber extends User {
  role: 'ADMIN' | 'BARBER'
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
  paymentStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED'
  paymentAmount: number
  commission: number
  user: User
  barber: Barber
  service: Service
}

export interface BusinessHour {
  weekday: number
  opensAt: string
  closesAt: string
  enabled: boolean
}

export interface Barbershop {
  id: string
  slug: string
  name: string
  logoUrl?: string | null
  primaryColor: string
  address?: string | null
  timezone: string
  depositType: 'NONE' | 'PERCENTAGE' | 'FIXED' | 'FULL'
  depositValue: number
  monthlyFeeCents: number
  commissionBps: number
  businessHours: BusinessHour[]
  subscriptionStatus?: 'INACTIVE' | 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
  mercadoPagoConnected?: boolean
}

export interface AppointmentCheckout {
  appointment: Appointment
  checkoutUrl: string | null
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
