export type Role = 'ADMIN' | 'BARBER' | 'CUSTOMER'

export interface User {
  id: string
  name: string
  email?: string
  phone?: string | null
  telegramId?: string | null
  noShowCount?: number
  role: Role
}

export interface Barber extends User {
  role: 'ADMIN' | 'BARBER'
  specialty: string
  available?: boolean
  unavailableReason?: 'folga' | 'ausência' | 'fora da escala' | 'agenda cheia' | null
  slotCount?: number
  firstAvailableTime?: string | null
  nextAvailableDate?: string | null
}

export interface Service {
  id: string
  name: string
  duration: number
  price: number
  active?: boolean
}

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'DONE' | 'NO_SHOW'

export interface Appointment {
  id: string
  userId: string
  barberId: string
  serviceId: string
  scheduledAt: string
  status: AppointmentStatus
  paymentStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED'
  paymentExpiresAt: string | null
  paymentAmount: number
  commission: number
  depositRetained?: boolean
  clientConfirmed?: boolean
  reminders?: AppointmentReminder[]
  user: User
  barber: Barber
  service: Service
}

export interface AppointmentReminder {
  kind: '24h' | '2h'
  channel: 'telegram'
  sentAt: string
  deliveredOk: boolean
  error: string | null
}

export interface BusinessHour {
  weekday: number
  opensAt: string
  closesAt: string
  breakStartsAt?: string | null
  breakEndsAt?: string | null
  enabled: boolean
}

export interface Holiday {
  id: string
  date: string
  description: string
}

export interface BarberAbsence {
  id: string
  barberId: string
  startsAt: string
  endsAt: string
  reason: string
  barberName?: string
}

export interface NewBarberAbsence {
  startsAt: string
  endsAt: string
  reason: string
}

export interface BarberSchedule {
  id?: string
  barberId?: string
  weekday: number
  startsAt: string
  endsAt: string
  enabled: boolean
}

export interface NewHoliday {
  date: string
  description: string
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
  remindersEnabled?: boolean
  reminderHoursBefore?: number[]
  businessHours: BusinessHour[]
  subscriptionStatus?: 'INACTIVE' | 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
  mercadoPagoConnected?: boolean
  membershipRole: 'OWNER' | 'ADMIN' | 'BARBER' | null
}

export interface AppointmentCheckout {
  appointment: Appointment
  checkoutUrl: string | null
}

export interface AvailabilitySlot {
  scheduledAt: string
  label: string
  barbers?: Array<Pick<Barber, 'id' | 'name'>>
}

export interface AppointmentAvailability {
  date: string
  timezone: string
  open: boolean
  reason: string | null
  slots: AvailabilitySlot[]
}

export interface CalendarHours {
  opensAt: string
  closesAt: string
  breakStartsAt: string | null
  breakEndsAt: string | null
}

export interface CalendarAppointment extends Appointment {
  time: string
}

export interface AppointmentCalendarDay {
  date: string
  open: boolean
  reason: string | null
  hours: CalendarHours | null
  appointments: CalendarAppointment[]
  absences: BarberAbsence[]
}

export interface AppointmentCalendar {
  from: string
  to: string
  timezone: string
  days: AppointmentCalendarDay[]
}

export interface NewAppointment {
  barberId: string
  serviceId: string
  scheduledAt: string
}

export type NewWalkInAppointment = NewAppointment & (
  | { userId: string; customer?: never }
  | { customer: { name: string; phone?: string }; userId?: never }
)

export interface CustomerSummary {
  id: string
  name: string
  phone: string | null
  noShowCount: number
}

export interface CustomerProfileFields {
  preferences: string | null
  notes: string | null
  allergies: string | null
}

export interface CustomerProfileResponse {
  profile: (CustomerProfileFields & {
    id: string
    updatedAt: string
    updatedBy: Pick<User, 'id' | 'name'>
  }) | null
  history: {
    completedAppointments: number
    noShows: number
    lastService: Pick<Service, 'id' | 'name'> | null
    lastBarber: Pick<Barber, 'id' | 'name'> | null
    averageTicket: number
  }
}

export interface LastAppointment {
  service: Service
  barber: Pick<Barber, 'id' | 'name' | 'specialty'> & { available: boolean }
  repeatable: boolean
  unavailableReason: string | null
}

export interface NewService {
  name: string
  duration: number
  price: number
}

export interface Product {
  id: string
  name: string
  price: number
  stockQuantity: number
  active: boolean
}

export interface NewProduct {
  name: string
  price: number
  stockQuantity: number
}

export interface UpdateProduct {
  name?: string
  price?: number
  active?: boolean
}

export interface NewProductSale {
  quantity: number
  appointmentId?: string
}

export interface ProductSale {
  id: string
  product: Pick<Product, 'id' | 'name'>
  quantity: number
  unitPrice: number
  total: number
  soldBy: Pick<User, 'id' | 'name'>
  appointmentId: string | null
  createdAt: string
}

export interface ReportRankedItem {
  id: string
  name: string
  quantity: number
  revenueCents: number
}

export interface BarberReport {
  barber: Pick<User, 'id' | 'name'>
  completedAppointments: number
  serviceRevenueCents: number
  productsSold: number
  productRevenueCents: number
  platformCommissionCents: number
  netRevenueCents: number
}

export interface RevenueReport {
  period: { from: string; to: string; timezone: string }
  cashBasis: 'DONE_ONLY'
  notice: string
  byBarber: BarberReport[]
  noShows: number
  cancellations: number
  averageTicketCents: number
  topServices: ReportRankedItem[]
  topProducts: ReportRankedItem[]
  totals: Omit<BarberReport, 'barber'> & { grossRevenueCents: number }
}

export interface LoyaltyProgram {
  id: string
  enabled: boolean
  requiredVisits: number
  rewardDescription: string
}

export interface LoyaltyCard {
  program: LoyaltyProgram | null
  availableStamps: number
  availableRewards: number
  remainingToReward: number
  stamps: Array<{ id: string; appointmentId: string; createdAt: string; redeemedAt: string | null }>
}

export interface LoyaltyProgramInput {
  enabled: boolean
  requiredVisits: number
  rewardDescription: string
}
