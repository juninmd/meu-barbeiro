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
  walkInQueueId?: string | null
  customerSubscriptionId?: string | null
  recurringBookingId?: string | null
  scheduledAt: string
  status: AppointmentStatus
  paymentStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED'
  paymentExpiresAt: string | null
  paymentAmount: number
  commission: number
  depositRetained?: boolean
  clientConfirmed?: boolean
  reminders?: AppointmentReminder[]
  cancellation?: AppointmentCancellation | null
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

export interface MembershipPlan {
  id: string
  name: string
  priceCents: number
  intervalDays: number
  includedVisits: number
  serviceIds: string[]
  active: boolean
}

export interface CustomerSubscription {
  id: string
  userId: string
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED'
  currentPeriodStart: string
  currentPeriodEnd: string
  visitsUsed: number
  plan: MembershipPlan
  user?: Pick<User, 'id' | 'name' | 'email' | 'phone'>
}

export interface RecurringBookingOccurrence {
  id: string
  scheduledAt: string
  status: 'CREATED' | 'PENDING'
  reason: string | null
}

export interface RecurringBooking {
  id: string
  subscriptionId: string
  userId: string
  barberId: string
  serviceIds: string[]
  weekday: number
  time: string
  active: boolean
  user?: Pick<User, 'id' | 'name'>
  barber?: Pick<User, 'id' | 'name'>
  subscription?: CustomerSubscription
  occurrences: RecurringBookingOccurrence[]
}

export interface NewMembershipPlan {
  name: string
  priceCents: number
  intervalDays: number
  includedVisits: number
  serviceIds: string[]
  active?: boolean
}

export interface NewRecurringBooking {
  subscriptionId: string
  userId?: string
  barberId: string
  serviceIds: string[]
  weekday: number
  time: string
}

export interface AppointmentCancellation {
  cancelledByRole: 'CUSTOMER' | 'BARBER' | 'OWNER' | 'ADMIN'
  reason: string | null
  hoursBefore: number
  refundedCents: number
  feeCents: number
  createdAt: string
}

export interface CancellationQuote {
  hoursBefore: number
  late: boolean
  refundedCents: number
  feeCents: number
}

export type StaffNotificationType = 'NEW_APPOINTMENT' | 'CANCELLATION' | 'RESCHEDULE' | 'NO_SHOW' | 'DAILY_SUMMARY'

export interface NotificationPreferences {
  notificationTypes: StaffNotificationType[]
  dailySummaryTime: string
  telegramLinked: boolean
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
  cancellationWindowHours: number
  lateCancellationFeeBps: number
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

export type WalkInQueueStatus = 'WAITING' | 'IN_SERVICE' | 'DONE' | 'GAVE_UP'

export interface WalkInQueueEntry {
  id: string
  userId: string | null
  guestName: string | null
  name: string
  serviceIds: string[]
  services: Service[]
  barberId: string | null
  barber: Pick<Barber, 'id' | 'name'> | null
  assignedBarber: Pick<Barber, 'id' | 'name'> | null
  status: WalkInQueueStatus
  arrivedAt: string
  calledAt: string | null
  finishedAt: string | null
  position: number | null
  estimatedMinutes: number | null
  estimatedStartAt: string | null
  createdAt: string
}

export interface NewWalkInQueueEntry {
  userId?: string
  guestName?: string
  serviceIds: string[]
  barberId?: string | null
}

export interface FitNowBarber {
  barber: Pick<Barber, 'id' | 'name'>
  fitsNow: boolean
  nextAvailableAt: string | null
  currentServiceMinutesLeft: number
}

export interface FitNowResponse {
  serviceIds: string[]
  duration: number
  checkedAt: string
  timezone: string
  barbers: FitNowBarber[]
}

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

export interface CancellationReport {
  period: { from: string; to: string; timezone: string }
  total: number
  byCancelledBy: Record<'CUSTOMER' | 'BARBER' | 'OWNER' | 'ADMIN', number>
  byTiming: { late: number; advance: number }
  lostRevenueCents: number
  retainedFeeCents: number
  topCustomers: Array<{ id: string; name: string; cancellations: number }>
  byWeekday: Array<{ weekday: number; label: string; cancellations: number }>
  byHour: Array<{ hour: number; label: string; cancellations: number }>
  waitlistReused: number
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
