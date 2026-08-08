import axios from 'axios'
import type {
  Appointment,
  AppointmentAvailability,
  AppointmentCalendar,
  AppointmentCheckout,
  AppointmentStatus,
  Barber,
  BarberAbsence,
  BarberSchedule,
  Barbershop,
  CustomerProfileFields,
  CustomerProfileResponse,
  CustomerSummary,
  Holiday,
  LastAppointment,
  LoyaltyCard,
  LoyaltyProgram,
  LoyaltyProgramInput,
  NewAppointment,
  NewBarberAbsence,
  NewHoliday,
  NewProduct,
  NewProductSale,
  NewWalkInAppointment,
  NewService,
  Product,
  ProductSale,
  Role,
  RevenueReport,
  Service,
  UpdateProduct,
  User,
} from '../types'

const tenantSlug = window.location.pathname.match(/^\/b\/([a-z0-9-]+)/)?.[1]
  || import.meta.env.VITE_BARBERSHOP_SLUG
  || 'barbearia-central'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: { 'x-barbershop-slug': tenantSlug },
})

export const mockEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCKS !== 'false'

export const errorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    const message = error.response?.data?.message
    return message === 'Acesso negado para esta barbearia'
      ? 'Apenas o dono da barbearia pode alterar isso.'
      : message || fallback
  }
  return error instanceof Error ? error.message : fallback
}

const customer: User = {
  id: 'customer-demo',
  name: 'Marina Costa',
  email: 'marina@demo.local',
  telegramId: '1001',
  role: 'CUSTOMER',
}

const barbers: Barber[] = [
  { id: 'barber-demo', name: 'Rafael Navalha', email: 'rafael@demo.local', role: 'BARBER', specialty: 'Clássicos & barba' },
  { id: 'barber-2', name: 'Caio Santos', email: 'caio@demo.local', role: 'BARBER', specialty: 'Degradê & freestyle' },
]

const initialServices: Service[] = [
  { id: 'service-cut', name: 'Corte assinatura', duration: 45, price: 55, active: true },
  { id: 'service-beard', name: 'Barba terapêutica', duration: 30, price: 38, active: true },
  { id: 'service-combo', name: 'Corte + barba', duration: 75, price: 85, active: true },
]

const initialProducts: Product[] = [
  { id: 'product-pomade', name: 'Pomada modeladora', price: 32, stockQuantity: 8, active: true },
  { id: 'product-shampoo', name: 'Shampoo para barba', price: 28, stockQuantity: 3, active: true },
  { id: 'product-balm', name: 'Balm pós-barba', price: 35, stockQuantity: 0, active: true },
]

interface MockState {
  barbershop: Barbershop
  services: Service[]
  appointments: Appointment[]
  products: Product[]
  productSales: ProductSale[]
  holidays: Holiday[]
  barberAbsences: BarberAbsence[]
  barberSchedules: BarberSchedule[]
  customerProfiles: Record<string, CustomerProfileFields>
  loyaltyProgram: LoyaltyProgram
  loyaltyStamps: Array<LoyaltyCard['stamps'][number] & { userId: string }>
}

const storageKey = 'meu-barbeiro:mock-state:v2'

const initialBarbershop: Barbershop = {
  id: 'barbershop-demo',
  slug: 'barbearia-central',
  name: 'Barbearia Central',
  logoUrl: null,
  primaryColor: '#d99b32',
  address: 'Rua das Navalhas, 27 · Centro',
  timezone: 'America/Sao_Paulo',
  depositType: 'FULL',
  depositValue: 0,
  monthlyFeeCents: 2_000,
  commissionBps: 100,
  remindersEnabled: true,
  reminderHoursBefore: [24, 2],
  subscriptionStatus: 'ACTIVE',
  mercadoPagoConnected: true,
  membershipRole: 'OWNER',
  businessHours: Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    opensAt: '09:00',
    closesAt: '20:00',
    breakStartsAt: weekday >= 2 && weekday <= 6 ? '12:00' : null,
    breakEndsAt: weekday >= 2 && weekday <= 6 ? '13:00' : null,
    enabled: weekday >= 2 && weekday <= 6,
  })),
}

const futureAt = (days: number, hours: number, minutes = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

const seedState = (): MockState => ({
  barbershop: initialBarbershop,
  services: initialServices,
  products: initialProducts.map((product) => ({ ...product })),
  productSales: [],
  holidays: [],
  barberAbsences: [],
  barberSchedules: [],
  customerProfiles: {
    [customer.id]: { preferences: 'Máquina 2 dos lados', notes: 'Prefere atendimento mais silencioso', allergies: 'Pomada com fragrância forte' },
  },
  loyaltyProgram: { id: 'loyalty-demo', enabled: true, requiredVisits: 10, rewardDescription: 'Um corte por nossa conta' },
  loyaltyStamps: [],
  appointments: [
    {
      id: 'appointment-1',
      userId: customer.id,
      barberId: barbers[0].id,
      serviceId: initialServices[2].id,
      scheduledAt: futureAt(0, 14),
      status: 'CONFIRMED',
      paymentStatus: 'APPROVED',
      paymentExpiresAt: null,
      paymentAmount: 85,
      commission: 0.85,
      clientConfirmed: true,
      reminders: [{ kind: '24h', channel: 'telegram', sentAt: '2026-01-01T12:00:00.000Z', deliveredOk: true, error: null }],
      user: customer,
      barber: barbers[0],
      service: initialServices[2],
    },
    {
      id: 'appointment-2',
      userId: 'customer-2',
      barberId: barbers[0].id,
      serviceId: initialServices[0].id,
      scheduledAt: futureAt(0, 16),
      status: 'PENDING',
      paymentStatus: 'APPROVED',
      paymentExpiresAt: null,
      paymentAmount: 55,
      commission: 0.55,
      clientConfirmed: false,
      reminders: [{ kind: '24h', channel: 'telegram', sentAt: '2026-01-01T12:00:00.000Z', deliveredOk: true, error: null }],
      user: { id: 'customer-2', name: 'Pedro Lima', role: 'CUSTOMER' },
      barber: barbers[0],
      service: initialServices[0],
    },
    {
      id: 'appointment-3',
      userId: 'customer-3',
      barberId: barbers[0].id,
      serviceId: initialServices[1].id,
      scheduledAt: futureAt(1, 10, 30),
      status: 'CONFIRMED',
      paymentStatus: 'APPROVED',
      paymentExpiresAt: null,
      paymentAmount: 38,
      commission: 0.38,
      clientConfirmed: true,
      reminders: [],
      user: { id: 'customer-3', name: 'Lucas Rocha', role: 'CUSTOMER' },
      barber: barbers[0],
      service: initialServices[1],
    },
  ],
})

const readState = (): MockState => {
  const stored = localStorage.getItem(storageKey)
  if (!stored) return seedState()

  try {
    const parsed = JSON.parse(stored) as Partial<MockState>
    const seeded = seedState()
    return {
      barbershop: {
        ...seeded.barbershop,
        ...parsed.barbershop,
        remindersEnabled: parsed.barbershop?.remindersEnabled ?? seeded.barbershop.remindersEnabled,
        reminderHoursBefore: parsed.barbershop?.reminderHoursBefore ?? seeded.barbershop.reminderHoursBefore,
      },
      services: (parsed.services ?? seeded.services).map((service) => ({ ...service, active: service.active ?? true })),
      appointments: (parsed.appointments ?? seeded.appointments).map((appointment) => ({
        ...appointment,
        clientConfirmed: appointment.clientConfirmed ?? false,
        reminders: appointment.reminders ?? [],
      })),
      products: parsed.products ?? seeded.products,
      productSales: parsed.productSales ?? seeded.productSales,
      holidays: parsed.holidays ?? seeded.holidays,
      barberAbsences: parsed.barberAbsences ?? seeded.barberAbsences,
      barberSchedules: parsed.barberSchedules ?? seeded.barberSchedules,
      customerProfiles: parsed.customerProfiles ?? seeded.customerProfiles,
      loyaltyProgram: parsed.loyaltyProgram ?? seeded.loyaltyProgram,
      loyaltyStamps: parsed.loyaltyStamps ?? seeded.loyaltyStamps,
    }
  } catch {
    localStorage.removeItem(storageKey)
    return seedState()
  }
}

const writeState = (state: MockState) => localStorage.setItem(storageKey, JSON.stringify(state))

const depositAmount = (price: number, barbershop: Barbershop): number => {
  if (barbershop.depositType === 'NONE') return 0
  if (barbershop.depositType === 'FULL') return price
  if (barbershop.depositType === 'PERCENTAGE') return Math.round(price * barbershop.depositValue) / 100
  return Math.min(price, barbershop.depositValue / 100)
}

const commissionAmount = (price: number, barbershop: Barbershop): number => (
  Math.round(Math.round(price * 100) * barbershop.commissionBps / 10_000) / 100
)

const overlapsLunch = (
  start: number,
  end: number,
  hours: Barbershop['businessHours'][number] | undefined,
) => Boolean(
  hours?.breakStartsAt
  && hours.breakEndsAt
  && start < minutes(hours.breakEndsAt)
  && minutes(hours.breakStartsAt) < end,
)

const validDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
  && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value

const weekdayNumbers: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

const localParts = (date: Date, timeZone: string) => Object.fromEntries(new Intl.DateTimeFormat('en-US', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}).formatToParts(date).map((part) => [part.type, part.value]))

const minutes = (value: string): number => {
  const [hour, minute] = value.split(':').map(Number)
  return (hour ?? 0) * 60 + (minute ?? 0)
}

const dateAtLocalTime = (date: string, time: string, timezone: string): Date => {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const target = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0)
  let timestamp = target

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const local = localParts(new Date(timestamp), timezone)
    const represented = Date.UTC(
      Number(local.year),
      Number(local.month) - 1,
      Number(local.day),
      Number(local.hour),
      Number(local.minute),
    )
    timestamp += target - represented
  }

  return new Date(timestamp)
}

const occupiesSchedule = (appointment: Appointment) => (
  ['PENDING', 'CONFIRMED'].includes(appointment.status)
  && (appointment.paymentStatus !== 'PENDING'
    || Boolean(appointment.paymentExpiresAt && new Date(appointment.paymentExpiresAt).getTime() > Date.now()))
)

const validateMockSchedule = (
  state: MockState,
  barberId: string,
  service: Service,
  value: string,
  excludeAppointmentId?: string,
) => {
  const scheduledAt = new Date(value)
  if (Number.isNaN(scheduledAt.getTime())) throw new Error('Horário inválido')
  if (scheduledAt.getTime() <= Date.now()) throw new Error('Horário deve estar no futuro')
  const scheduledParts = localParts(scheduledAt, state.barbershop.timezone)
  const configuredHours = state.barbershop.businessHours.find((item) => item.weekday === weekdayNumbers[scheduledParts.weekday ?? ''])
  const startAt = Number(scheduledParts.hour) * 60 + Number(scheduledParts.minute)
  const opensAt = configuredHours ? minutes(configuredHours.opensAt) : 0
  const closesAt = configuredHours ? minutes(configuredHours.closesAt) : 0
  if (!configuredHours?.enabled || startAt < opensAt || startAt + service.duration > closesAt) {
    throw new Error(configuredHours?.enabled
      ? `Escolha um horário entre ${configuredHours.opensAt} e ${configuredHours.closesAt}`
      : 'A barbearia não atende neste dia')
  }
  const barberSchedule = state.barberSchedules.filter((item) => item.barberId === barberId)
  if (barberSchedule.length > 0) {
    const configuredBarber = barberSchedule.find((item) => item.weekday === weekdayNumbers[scheduledParts.weekday ?? ''])
    if (!configuredBarber?.enabled
      || startAt < minutes(configuredBarber.startsAt)
      || startAt + service.duration > minutes(configuredBarber.endsAt)) {
      throw new Error('Este barbeiro não atende neste horário')
    }
  }
  if (overlapsLunch(startAt, startAt + service.duration, configuredHours)) {
    throw new Error('Este horário coincide com o intervalo de almoço')
  }
  const scheduledDate = `${scheduledParts.year}-${scheduledParts.month}-${scheduledParts.day}`
  if (state.holidays.some((holiday) => holiday.date === scheduledDate)) {
    throw new Error('A barbearia não atende neste feriado')
  }
  const requestedStart = scheduledAt.getTime()
  const requestedEnd = requestedStart + service.duration * 60_000
  const absence = state.barberAbsences.find((item) => item.barberId === barberId
    && new Date(item.startsAt).getTime() < requestedEnd
    && requestedStart < new Date(item.endsAt).getTime())
  if (absence) throw new Error(`Barbeiro indisponível: ${absence.reason}`)
  const conflict = state.appointments.some((item) => {
    if (item.id === excludeAppointmentId || item.barberId !== barberId || !occupiesSchedule(item)) return false
    const existingStart = new Date(item.scheduledAt).getTime()
    const existingEnd = existingStart + item.service.duration * 60_000
    return existingStart < requestedEnd && requestedStart < existingEnd
  })
  if (conflict) throw new Error('Este horário acabou de ser reservado')
  return scheduledAt
}

const selectedMockUser = (role: Role): User => role === 'BARBER' ? barbers[0] : customer

const mockCustomerProfile = (state: MockState, userId: string): CustomerProfileResponse => {
  const history = state.appointments
    .filter((appointment) => appointment.userId === userId && ['DONE', 'NO_SHOW'].includes(appointment.status))
    .sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt))
  if (!state.appointments.some((appointment) => appointment.userId === userId)) {
    throw new Error('Cliente não encontrado nesta barbearia')
  }
  const completed = history.filter((appointment) => appointment.status === 'DONE')
  const last = completed[0]
  const fields = state.customerProfiles[userId]
  return {
    profile: fields ? {
      id: `profile-${userId}`,
      ...fields,
      updatedAt: new Date().toISOString(),
      updatedBy: { id: barbers[0].id, name: barbers[0].name },
    } : null,
    history: {
      completedAppointments: completed.length,
      noShows: history.filter((appointment) => appointment.status === 'NO_SHOW').length,
      lastService: last ? { id: last.service.id, name: last.service.name } : null,
      lastBarber: last ? { id: last.barber.id, name: last.barber.name } : null,
      averageTicket: completed.length ? completed.reduce((total, appointment) => total + appointment.service.price, 0) / completed.length : 0,
    },
  }
}

export const repository = {
  async currentUser(): Promise<User | null> {
    if (mockEnabled) return null
    const { data } = await api.get<User | null>('/auth/me')
    if (!data || typeof data !== 'object' || !('role' in data) || !['ADMIN', 'BARBER', 'CUSTOMER'].includes(data.role)) return null
    return data
  },

  mockUser(role: Role): User {
    if (!mockEnabled) throw new Error('Acesso de demonstração indisponível')
    return selectedMockUser(role)
  },

  loginWithGoogle(): void {
    window.location.href = `${api.defaults.baseURL}/auth/google`
  },

  async logout(): Promise<void> {
    if (!mockEnabled) await api.post('/auth/logout')
  },

  async services(): Promise<Service[]> {
    if (mockEnabled) return readState().services.filter((service) => service.active !== false)
    return (await api.get<Service[]>('/services')).data
  },

  async barbershop(): Promise<Barbershop> {
    if (mockEnabled) return { ...readState().barbershop, membershipRole: 'OWNER' }
    return (await api.get<Barbershop>('/barbershops/current')).data
  },

  async updateBarbershop(input: Barbershop): Promise<Barbershop> {
    if (!mockEnabled) return (await api.patch<Barbershop>('/barbershops/current', input)).data
    const state = readState()
    state.barbershop = { ...state.barbershop, ...input }
    writeState(state)
    return state.barbershop
  },

  async holidays(year?: number): Promise<Holiday[]> {
    if (!mockEnabled) return (await api.get<Holiday[]>('/barbershops/current/holidays', { params: { year } })).data
    return readState().holidays
      .filter((holiday) => year === undefined || holiday.date.startsWith(`${year.toString().padStart(4, '0')}-`))
      .sort((a, b) => a.date.localeCompare(b.date))
  },

  async createHoliday(input: NewHoliday): Promise<Holiday> {
    if (!mockEnabled) return (await api.post<Holiday>('/barbershops/current/holidays', input)).data
    if (!validDateOnly(input.date)) throw new Error('Data inválida')
    const description = input.description.trim()
    if (description.length < 3 || description.length > 80) throw new Error('Descrição do feriado inválida')
    const state = readState()
    if (state.holidays.some((holiday) => holiday.date === input.date)) {
      throw new Error('Já existe um feriado cadastrado nesta data')
    }
    const holiday = { id: crypto.randomUUID(), date: input.date, description }
    state.holidays.push(holiday)
    writeState(state)
    return holiday
  },

  async deleteHoliday(id: string): Promise<void> {
    if (!mockEnabled) {
      await api.delete(`/barbershops/current/holidays/${id}`)
      return
    }
    const state = readState()
    if (!state.holidays.some((holiday) => holiday.id === id)) throw new Error('Feriado não encontrado')
    state.holidays = state.holidays.filter((holiday) => holiday.id !== id)
    writeState(state)
  },

  async subscribe(): Promise<{ checkoutUrl: string | null }> {
    if (!mockEnabled) return (await api.post<{ checkoutUrl: string }>('/billing/mercado-pago/subscription')).data
    const state = readState()
    state.barbershop.subscriptionStatus = 'ACTIVE'
    writeState(state)
    return { checkoutUrl: null }
  },

  async connectMercadoPago(): Promise<{ authorizationUrl: string | null }> {
    if (!mockEnabled) return (await api.get<{ authorizationUrl: string }>('/billing/mercado-pago/connect')).data
    const state = readState()
    state.barbershop.mercadoPagoConnected = true
    writeState(state)
    return { authorizationUrl: null }
  },

  async disconnectMercadoPago(): Promise<void> {
    if (!mockEnabled) {
      await api.post('/billing/mercado-pago/disconnect')
      return
    }
    const state = readState()
    state.barbershop.mercadoPagoConnected = false
    writeState(state)
  },

  async barbers(): Promise<Barber[]> {
    if (mockEnabled) return barbers
    return (await api.get<Barber[]>('/barbers')).data
  },

  async barberAbsences(barberId: string): Promise<BarberAbsence[]> {
    if (!mockEnabled) return (await api.get<BarberAbsence[]>(`/barbers/${barberId}/absences`)).data
    return readState().barberAbsences
      .filter((item) => item.barberId === barberId && new Date(item.endsAt).getTime() > Date.now())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  },

  async createBarberAbsence(barberId: string, input: NewBarberAbsence): Promise<BarberAbsence> {
    if (!mockEnabled) return (await api.post<BarberAbsence>(`/barbers/${barberId}/absences`, input)).data
    const startsAt = new Date(input.startsAt)
    const endsAt = new Date(input.endsAt)
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new Error('O fim da ausência deve ser posterior ao início')
    }
    const state = readState()
    const conflicts = state.appointments.filter((item) => item.barberId === barberId && occupiesSchedule(item)
      && new Date(item.scheduledAt).getTime() < endsAt.getTime()
      && startsAt.getTime() < new Date(item.scheduledAt).getTime() + item.service.duration * 60_000).length
    if (conflicts > 0) {
      throw new Error(`${conflicts} atendimento${conflicts === 1 ? '' : 's'} conflita${conflicts === 1 ? '' : 'm'} com esta ausência`)
    }
    const absence = { id: crypto.randomUUID(), barberId, ...input, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() }
    state.barberAbsences.push(absence)
    writeState(state)
    return absence
  },

  async deleteBarberAbsence(barberId: string, absenceId: string): Promise<void> {
    if (!mockEnabled) {
      await api.delete(`/barbers/${barberId}/absences/${absenceId}`)
      return
    }
    const state = readState()
    if (!state.barberAbsences.some((item) => item.id === absenceId && item.barberId === barberId)) {
      throw new Error('Ausência não encontrada')
    }
    state.barberAbsences = state.barberAbsences.filter((item) => item.id !== absenceId || item.barberId !== barberId)
    writeState(state)
  },

  async barberSchedule(barberId: string): Promise<BarberSchedule[]> {
    if (!mockEnabled) return (await api.get<BarberSchedule[]>(`/barbers/${barberId}/schedule`)).data
    return readState().barberSchedules.filter((item) => item.barberId === barberId).sort((a, b) => a.weekday - b.weekday)
  },

  async updateBarberSchedule(barberId: string, schedule: BarberSchedule[]): Promise<BarberSchedule[]> {
    if (!mockEnabled) return (await api.put<BarberSchedule[]>(`/barbers/${barberId}/schedule`, { schedule })).data
    if (schedule.some((item) => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.startsAt)
      || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.endsAt) || item.startsAt >= item.endsAt)) {
      throw new Error('A escala deve usar HH:MM e o início deve ser anterior ao fim')
    }
    const state = readState()
    state.barberSchedules = [
      ...state.barberSchedules.filter((item) => item.barberId !== barberId),
      ...schedule.map((item) => ({ ...item, id: item.id ?? crypto.randomUUID(), barberId })),
    ]
    writeState(state)
    return state.barberSchedules.filter((item) => item.barberId === barberId).sort((a, b) => a.weekday - b.weekday)
  },

  async appointments(user: User): Promise<Appointment[]> {
    if (mockEnabled) {
      const items = readState().appointments
      return items.filter((item) => user.role === 'BARBER' ? item.barberId === user.id : item.userId === user.id)
    }
    return (await api.get<Appointment[]>('/appointments')).data
  },

  async customers(query = ''): Promise<CustomerSummary[]> {
    if (!mockEnabled) return (await api.get<CustomerSummary[]>('/customers', { params: { search: query || undefined } })).data
    const state = readState()
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
    const phoneQuery = query.replace(/\D/g, '')
    const customers = new Map<string, CustomerSummary>()
    for (const appointment of state.appointments) {
      const current = customers.get(appointment.userId)
      customers.set(appointment.userId, {
        id: appointment.user.id,
        name: appointment.user.name,
        phone: appointment.user.phone ?? null,
        noShowCount: (current?.noShowCount ?? 0) + (appointment.status === 'NO_SHOW' ? 1 : 0),
      })
    }
    return [...customers.values()]
      .filter((item) => !normalizedQuery
        || item.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery)
        || Boolean(phoneQuery && item.phone?.includes(phoneQuery)))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, 20)
  },

  async customerProfile(userId: string): Promise<CustomerProfileResponse> {
    if (!mockEnabled) return (await api.get<CustomerProfileResponse>(`/customers/${userId}/profile`)).data
    return mockCustomerProfile(readState(), userId)
  },

  async saveCustomerProfile(userId: string, input: CustomerProfileFields): Promise<CustomerProfileResponse> {
    if (!mockEnabled) return (await api.put<CustomerProfileResponse>(`/customers/${userId}/profile`, input)).data
    const state = readState()
    if (!state.appointments.some((appointment) => appointment.userId === userId)) throw new Error('Cliente não encontrado nesta barbearia')
    state.customerProfiles[userId] = input
    writeState(state)
    return mockCustomerProfile(state, userId)
  },

  async lastAppointment(): Promise<LastAppointment | null> {
    if (!mockEnabled) return (await api.get<LastAppointment | null>('/appointments/last')).data
    const state = readState()
    const appointment = state.appointments
      .filter((item) => item.userId === customer.id && item.status === 'DONE')
      .sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt))[0]
    if (!appointment) return null
    const service = state.services.find((item) => item.id === appointment.serviceId)
    const barber = barbers.find((item) => item.id === appointment.barberId)
    const unavailableReason = !service || service.active === false
      ? 'O serviço do último atendimento não está mais disponível. Escolha outro serviço.'
      : !barber
        ? 'O barbeiro do último atendimento não faz mais parte desta barbearia. Escolha outro profissional.'
        : null
    return {
      service: service ?? { ...appointment.service, active: false },
      barber: barber
        ? { id: barber.id, name: barber.name, specialty: barber.specialty, available: true }
        : { id: appointment.barber.id, name: appointment.barber.name, specialty: appointment.barber.specialty, available: false },
      repeatable: !unavailableReason,
      unavailableReason,
    }
  },

  async appointmentCalendar(from: string, to: string): Promise<AppointmentCalendar> {
    if (!mockEnabled) {
      return (await api.get<AppointmentCalendar>('/appointments/calendar', { params: { from, to } })).data
    }

    const dates = calendarDates(from, to)
    if (!dates || dates.length > 62) throw new Error('O intervalo deve ter no máximo 62 dias')
    const state = readState()
    const { timezone, businessHours } = state.barbershop
    const appointmentsByDate = new Map<string, Appointment[]>()
    for (const appointment of state.appointments) {
      const parts = localParts(new Date(appointment.scheduledAt), timezone)
      const date = `${parts.year}-${parts.month}-${parts.day}`
      if (date < from || date > to) continue
      appointmentsByDate.set(date, [...(appointmentsByDate.get(date) ?? []), appointment])
    }

    return {
      from,
      to,
      timezone,
      days: dates.map((date) => {
        const holiday = state.holidays.find((item) => item.date === date)
        const weekday = weekdayNumbers[localParts(dateAtLocalTime(date, '12:00', timezone), timezone).weekday ?? '']
        const hours = businessHours.find((item) => item.weekday === weekday)
        const open = !holiday && Boolean(hours?.enabled)
        return {
          date,
          open,
          reason: holiday ? `Feriado: ${holiday.description}` : open ? null : 'Fora do expediente',
          hours: open && hours ? {
            opensAt: hours.opensAt,
            closesAt: hours.closesAt,
            breakStartsAt: hours.breakStartsAt ?? null,
            breakEndsAt: hours.breakEndsAt ?? null,
          } : null,
          absences: state.barberAbsences.filter((absence) => {
            const startsAt = new Date(absence.startsAt).getTime()
            const endsAt = new Date(absence.endsAt).getTime()
            const nextDate = new Date(Date.parse(`${date}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10)
            return startsAt < dateAtLocalTime(nextDate, '00:00', timezone).getTime()
              && dateAtLocalTime(date, '00:00', timezone).getTime() < endsAt
          }).map((absence) => ({
            ...absence,
            barberName: barbers.find((barber) => barber.id === absence.barberId)?.name,
          })),
          appointments: (appointmentsByDate.get(date) ?? [])
            .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
            .map((appointment) => ({
              ...appointment,
              time: new Intl.DateTimeFormat('pt-BR', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
              }).format(new Date(appointment.scheduledAt)),
            })),
        }
      }),
    }
  },

  async availability(barberId: string, serviceId: string, date: string, appointmentId?: string): Promise<AppointmentAvailability> {
    if (!mockEnabled) {
      return (await api.get<AppointmentAvailability>('/appointments/availability', {
        params: { barberId, serviceId, date, appointmentId },
      })).data
    }

    const state = readState()
    const service = state.services.find((item) => item.id === serviceId)
    if (!service || service.active === false) throw new Error('Serviço ou barbeiro inválido')
    if (barberId === 'any') {
      const results = await Promise.all(barbers.map(async (barber) => ({
        barber,
        availability: await repository.availability(barber.id, serviceId, date),
      })))
      const slots = new Map<string, NonNullable<AppointmentAvailability['slots'][number]>>()
      for (const result of results) {
        for (const slot of result.availability.slots) {
          const current = slots.get(slot.scheduledAt)
          if (current) current.barbers = [...(current.barbers ?? []), result.barber]
          else slots.set(slot.scheduledAt, { ...slot, barbers: [result.barber] })
        }
      }
      const availableSlots = [...slots.values()].sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))
      return {
        date,
        timezone: state.barbershop.timezone,
        open: results.some((result) => result.availability.open),
        reason: availableSlots.length ? null : results[0]?.availability.reason || 'Não há horários livres nesta data',
        slots: availableSlots,
      }
    }
    if (!barbers.some((item) => item.id === barberId)) throw new Error('Serviço ou barbeiro inválido')

    const { timezone, businessHours } = state.barbershop
    const weekday = weekdayNumbers[localParts(dateAtLocalTime(date, '12:00', timezone), timezone).weekday ?? '']
    const configured = businessHours.find((item) => item.weekday === weekday)
    if (!configured?.enabled) {
      return { date, timezone, open: false, reason: 'A barbearia não atende neste dia', slots: [] }
    }
    if (state.holidays.some((holiday) => holiday.date === date)) {
      return { date, timezone, open: false, reason: 'A barbearia não atende neste feriado', slots: [] }
    }
    const barberSchedule = state.barberSchedules.filter((item) => item.barberId === barberId)
    const configuredBarber = barberSchedule.find((item) => item.weekday === weekday)

    const appointments = state.appointments.filter((item) => (
      item.id !== appointmentId && item.barberId === barberId && occupiesSchedule(item)
    ))
    const slots = []
    for (let start = minutes(configured.opensAt); start + service.duration <= minutes(configured.closesAt); start += 15) {
      const label = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`
      const scheduledAt = dateAtLocalTime(date, label, timezone)
      const slotStart = scheduledAt.getTime()
      const slotEnd = slotStart + service.duration * 60_000
      const outsideBarberSchedule = barberSchedule.length > 0 && (!configuredBarber?.enabled
        || start < minutes(configuredBarber.startsAt)
        || start + service.duration > minutes(configuredBarber.endsAt))
      const absent = state.barberAbsences.some((item) => item.barberId === barberId
        && new Date(item.startsAt).getTime() < slotEnd
        && slotStart < new Date(item.endsAt).getTime())
      const conflict = appointments.some((item) => {
        const appointmentStart = new Date(item.scheduledAt).getTime()
        const appointmentEnd = appointmentStart + item.service.duration * 60_000
        return appointmentStart < slotEnd && slotStart < appointmentEnd
      })
      if (scheduledAt.getTime() > Date.now() && !conflict && !outsideBarberSchedule && !absent
        && !overlapsLunch(start, start + service.duration, configured)) {
        slots.push({ scheduledAt: scheduledAt.toISOString(), label })
      }
    }

    return { date, timezone, open: true, reason: slots.length ? null : 'Não há horários livres nesta data', slots }
  },

  async createAppointment(input: NewAppointment): Promise<AppointmentCheckout> {
    if (!mockEnabled) return (await api.post<AppointmentCheckout>('/appointments', input)).data

    const state = readState()
    const service = state.services.find((item) => item.id === input.serviceId)
    if (!service || service.active === false) throw new Error('Serviço ou barbeiro inválido')
    let barber = barbers.find((item) => item.id === input.barberId)
    if (input.barberId === 'any') {
      const scheduledAt = new Date(input.scheduledAt)
      if (Number.isNaN(scheduledAt.getTime())) throw new Error('Horário inválido')
      const parts = localParts(scheduledAt, state.barbershop.timezone)
      const date = `${parts.year}-${parts.month}-${parts.day}`
      const availability = await repository.availability('any', input.serviceId, date)
      const slot = availability.slots.find((item) => item.scheduledAt === scheduledAt.toISOString())
      barber = slot?.barbers
        ?.map((candidate) => ({
          ...barbers.find((item) => item.id === candidate.id)!,
          load: state.appointments.filter((appointment) => appointment.barberId === candidate.id
            && appointment.status !== 'CANCELLED'
            && `${localParts(new Date(appointment.scheduledAt), state.barbershop.timezone).year}-${localParts(new Date(appointment.scheduledAt), state.barbershop.timezone).month}-${localParts(new Date(appointment.scheduledAt), state.barbershop.timezone).day}` === date).length,
        }))
        .sort((left, right) => left.load - right.load || left.id.localeCompare(right.id))[0]
    }
    if (!barber) throw new Error('Este horário acabou de ser reservado')
    validateMockSchedule(state, barber.id, service, input.scheduledAt)
    const appointment: Appointment = {
      id: crypto.randomUUID(),
      userId: customer.id,
      ...input,
      barberId: barber.id,
      status: 'PENDING',
      paymentStatus: state.barbershop.depositType === 'NONE' ? 'NOT_REQUIRED' : 'APPROVED',
      paymentExpiresAt: null,
      paymentAmount: depositAmount(service.price, state.barbershop),
      commission: state.barbershop.depositType === 'NONE' ? 0 : commissionAmount(service.price, state.barbershop),
      clientConfirmed: false,
      reminders: [],
      user: customer,
      barber,
      service,
    }
    state.appointments.push(appointment)
    writeState(state)
    return { appointment, checkoutUrl: null }
  },

  async createWalkIn(input: NewWalkInAppointment): Promise<AppointmentCheckout> {
    if (!mockEnabled) return (await api.post<AppointmentCheckout>('/appointments/walk-in', input)).data

    const state = readState()
    if (state.barbershop.subscriptionStatus !== 'ACTIVE') {
      throw new Error('Agendamentos temporariamente indisponíveis: assinatura da barbearia inativa')
    }
    const service = state.services.find((item) => item.id === input.serviceId)
    const barber = barbers.find((item) => item.id === input.barberId)
    if (!service || !barber) throw new Error('Serviço ou barbeiro inválido')
    const scheduledAt = validateMockSchedule(state, input.barberId, service, input.scheduledAt)

    let user: User | undefined
    if ('userId' in input && input.userId) {
      user = state.appointments.find((item) => item.userId === input.userId)?.user
      if (!user) throw new Error('Cliente inválido')
    } else {
      if (!('customer' in input) || !input.customer) throw new Error('Cliente inválido')
      const customerInput = input.customer
      const phone = customerInput.phone?.replace(/\D/g, '') || null
      if (customerInput.phone && (!phone || phone.length < 8 || phone.length > 15)) throw new Error('Telefone inválido')
      user = phone
        ? state.appointments.find((item) => item.user.phone === phone)?.user
        : undefined
      user ??= { id: crypto.randomUUID(), name: customerInput.name.trim(), phone, role: 'CUSTOMER' }
    }
    const noShowCount = state.appointments.filter((item) => item.userId === user.id && item.status === 'NO_SHOW').length
    const appointment: Appointment = {
      id: crypto.randomUUID(),
      userId: user.id,
      barberId: barber.id,
      serviceId: service.id,
      scheduledAt: scheduledAt.toISOString(),
      status: 'CONFIRMED',
      paymentStatus: 'NOT_REQUIRED',
      paymentExpiresAt: null,
      paymentAmount: 0,
      commission: 0,
      clientConfirmed: false,
      reminders: [],
      depositRetained: false,
      user: { ...user, noShowCount },
      barber,
      service,
    }
    state.appointments.push(appointment)
    writeState(state)
    return { appointment, checkoutUrl: null }
  },

  async rescheduleAppointment(id: string, scheduledAt: string): Promise<Appointment> {
    if (!mockEnabled) return (await api.patch<Appointment>(`/appointments/${id}`, { scheduledAt })).data

    const state = readState()
    const appointment = state.appointments.find((item) => item.id === id)
    if (!appointment) throw new Error('Agendamento não encontrado')
    if (!['PENDING', 'CONFIRMED'].includes(appointment.status)) {
      throw new Error('Este agendamento não pode ser remarcado')
    }
    appointment.scheduledAt = validateMockSchedule(
      state,
      appointment.barberId,
      appointment.service,
      scheduledAt,
      appointment.id,
    ).toISOString()
    appointment.clientConfirmed = false
    writeState(state)
    return appointment
  },

  async updateAppointment(id: string, status: AppointmentStatus): Promise<Appointment> {
    if (!mockEnabled) return (await api.patch<Appointment>(`/appointments/${id}`, { status })).data

    const state = readState()
    const appointment = state.appointments.find((item) => item.id === id)
    if (!appointment) throw new Error('Agendamento não encontrado')
    const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['DONE', 'CANCELLED', 'NO_SHOW'],
      CANCELLED: [],
      DONE: [],
      NO_SHOW: [],
    }
    if (!transitions[appointment.status].includes(status)) throw new Error('Este agendamento não permite essa alteração')
    const previousStatus = appointment.status
    appointment.status = status
    if (status === 'CONFIRMED') appointment.clientConfirmed = false
    if (status === 'CANCELLED' && appointment.paymentStatus === 'APPROVED') appointment.paymentStatus = 'REFUNDED'
    appointment.depositRetained = status === 'NO_SHOW' && appointment.paymentStatus === 'APPROVED'
    if (status === 'NO_SHOW') appointment.user.noShowCount = (appointment.user.noShowCount ?? 0) + 1
    if (previousStatus !== 'DONE' && status === 'DONE' && state.loyaltyProgram.enabled
      && !state.loyaltyStamps.some((stamp) => stamp.appointmentId === appointment.id)) {
      state.loyaltyStamps.push({
        id: crypto.randomUUID(), userId: appointment.userId, appointmentId: appointment.id,
        createdAt: new Date().toISOString(), redeemedAt: null,
      })
    }
    if (previousStatus === 'DONE' && status !== 'DONE') {
      state.loyaltyStamps = state.loyaltyStamps.filter((stamp) => stamp.appointmentId !== appointment.id)
    }
    writeState(state)
    return appointment
  },

  async createService(input: NewService): Promise<Service> {
    if (!mockEnabled) return (await api.post<Service>('/services', input)).data

    const state = readState()
    const service = { id: crypto.randomUUID(), ...input, active: true }
    state.services.push(service)
    writeState(state)
    return service
  },

  async deleteService(id: string): Promise<void> {
    if (!mockEnabled) {
      await api.delete(`/services/${id}`)
      return
    }
    const state = readState()
    if (state.appointments.some((item) => item.serviceId === id && ['PENDING', 'CONFIRMED'].includes(item.status))) {
      throw new Error('Serviço possui agendamentos ativos')
    }
    const service = state.services.find((item) => item.id === id)
    if (!service) throw new Error('Serviço não encontrado')
    service.active = false
    writeState(state)
  },

  async products(): Promise<Product[]> {
    if (mockEnabled) return readState().products
    return (await api.get<Product[]>('/products')).data
  },

  async createProduct(input: NewProduct): Promise<Product> {
    if (!mockEnabled) return (await api.post<Product>('/products', input)).data
    const state = readState()
    if (state.products.some((item) => item.name.toLocaleLowerCase('pt-BR') === input.name.trim().toLocaleLowerCase('pt-BR'))) {
      throw new Error('Já existe um produto com esse nome')
    }
    if (input.name.trim().length < 3 || input.name.trim().length > 80) throw new Error('Nome do produto inválido')
    if (!Number.isFinite(input.price) || input.price <= 0 || input.price > 10_000) throw new Error('Preço do produto inválido')
    if (!Number.isInteger(input.stockQuantity) || input.stockQuantity < 0) throw new Error('Estoque do produto inválido')
    const product: Product = { id: crypto.randomUUID(), ...input, name: input.name.trim(), active: true }
    state.products.push(product)
    writeState(state)
    return product
  },

  async updateProduct(id: string, input: UpdateProduct): Promise<Product> {
    if (!mockEnabled) return (await api.patch<Product>(`/products/${id}`, input)).data
    const state = readState()
    const product = state.products.find((item) => item.id === id)
    if (!product) throw new Error('Produto não encontrado')
    const name = input.name?.trim()
    if (name !== undefined) {
      if (name.length < 3 || name.length > 80) throw new Error('Nome do produto inválido')
      if (state.products.some((item) => item.id !== id && item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) {
        throw new Error('Já existe um produto com esse nome')
      }
      product.name = name
    }
    if (input.price !== undefined) {
      if (!Number.isFinite(input.price) || input.price <= 0 || input.price > 10_000) throw new Error('Preço do produto inválido')
      product.price = input.price
    }
    if (input.active !== undefined) product.active = input.active
    writeState(state)
    return product
  },

  async addProductStock(id: string, quantity: number): Promise<Product> {
    if (!mockEnabled) return (await api.post<Product>(`/products/${id}/stock`, { quantity })).data
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Quantidade deve ser um número inteiro positivo')
    const state = readState()
    const product = state.products.find((item) => item.id === id)
    if (!product) throw new Error('Produto não encontrado')
    product.stockQuantity += quantity
    writeState(state)
    return product
  },

  async deleteProduct(id: string): Promise<void> {
    if (!mockEnabled) {
      await api.delete(`/products/${id}`)
      return
    }
    const state = readState()
    if (state.productSales.some((item) => item.product.id === id)) {
      throw new Error('Produto possui vendas registradas. Desative-o para preservar o histórico.')
    }
    if (!state.products.some((item) => item.id === id)) throw new Error('Produto não encontrado')
    state.products = state.products.filter((item) => item.id !== id)
    writeState(state)
  },

  async sellProduct(id: string, input: NewProductSale): Promise<ProductSale> {
    if (!mockEnabled) return (await api.post<ProductSale>(`/products/${id}/sales`, input)).data
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error('Quantidade deve ser um número inteiro positivo')
    const state = readState()
    const product = state.products.find((item) => item.id === id)
    if (!product) throw new Error('Produto não encontrado')
    if (!product.active) throw new Error('Produto inativo não pode ser vendido')
    if (input.appointmentId && !state.appointments.some((item) => item.id === input.appointmentId)) {
      throw new Error('Agendamento não pertence a esta barbearia')
    }
    if (product.stockQuantity < input.quantity) {
      throw new Error(`Estoque insuficiente. Disponível: ${product.stockQuantity}`)
    }
    const sale: ProductSale = {
      id: crypto.randomUUID(),
      product: { id: product.id, name: product.name },
      quantity: input.quantity,
      unitPrice: product.price,
      total: product.price * input.quantity,
      soldBy: { id: barbers[0].id, name: barbers[0].name },
      appointmentId: input.appointmentId ?? null,
      createdAt: new Date().toISOString(),
    }
    product.stockQuantity -= input.quantity
    state.productSales.push(sale)
    writeState(state)
    return sale
  },

  async productSales(from?: string, to?: string): Promise<ProductSale[]> {
    if (!mockEnabled) return (await api.get<ProductSale[]>('/products/sales', { params: { from, to } })).data
    const sales = readState().productSales
    if (!from && !to) {
      const today = new Date().toDateString()
      return sales.filter((item) => new Date(item.createdAt).toDateString() === today)
    }
    const fromTime = from ? new Date(from).getTime() : Number.NEGATIVE_INFINITY
    const toTime = to ? new Date(to).getTime() : Number.POSITIVE_INFINITY
    return sales.filter((item) => {
      const createdAt = new Date(item.createdAt).getTime()
      return createdAt >= fromTime && createdAt <= toTime
    })
  },

  async report(from: string, to: string): Promise<RevenueReport> {
    if (!mockEnabled) {
      const path = from === to ? '/reports/daily' : '/reports/summary'
      const params = from === to ? { date: from } : { from, to }
      return (await api.get<RevenueReport>(path, { params })).data
    }
    return mockReport(readState(), from, to)
  },

  async loyaltyMe(): Promise<LoyaltyCard> {
    if (!mockEnabled) return (await api.get<LoyaltyCard>('/loyalty/me')).data
    return mockLoyaltyCard(readState(), customer.id)
  },

  async loyaltyCard(userId: string): Promise<LoyaltyCard> {
    if (!mockEnabled) return (await api.get<LoyaltyCard>(`/loyalty/${userId}`)).data
    const state = readState()
    if (!state.appointments.some((appointment) => appointment.userId === userId)) throw new Error('Cliente não encontrado nesta barbearia')
    return mockLoyaltyCard(state, userId)
  },

  async updateLoyaltyProgram(input: LoyaltyProgramInput): Promise<LoyaltyProgram> {
    if (!mockEnabled) return (await api.put<LoyaltyProgram>('/loyalty/program', input)).data
    if (!Number.isInteger(input.requiredVisits) || input.requiredVisits < 1 || input.requiredVisits > 100) throw new Error('Quantidade de visitas inválida')
    if (input.rewardDescription.trim().length < 3 || input.rewardDescription.trim().length > 160) throw new Error('Descrição do prêmio inválida')
    const state = readState()
    state.loyaltyProgram = { ...state.loyaltyProgram, ...input, rewardDescription: input.rewardDescription.trim() }
    writeState(state)
    return state.loyaltyProgram
  },

  async loyaltyProgram(): Promise<LoyaltyProgram | null> {
    if (!mockEnabled) return (await api.get<LoyaltyProgram | null>('/loyalty/program')).data
    return readState().loyaltyProgram
  },

  async redeemLoyalty(userId: string): Promise<LoyaltyCard> {
    if (!mockEnabled) return (await api.post<LoyaltyCard>('/loyalty/redeem', { userId })).data
    const state = readState()
    const available = state.loyaltyStamps.filter((stamp) => stamp.userId === userId && stamp.redeemedAt === null)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    if (!state.loyaltyProgram.enabled) throw new Error('O programa de fidelidade não está ativo')
    if (available.length < state.loyaltyProgram.requiredVisits) throw new Error('O cliente ainda não possui selos suficientes')
    const redeemedAt = new Date().toISOString()
    for (const stamp of available.slice(0, state.loyaltyProgram.requiredVisits)) stamp.redeemedAt = redeemedAt
    writeState(state)
    return mockLoyaltyCard(state, userId)
  },
}

const mockLoyaltyCard = (state: MockState, userId: string): LoyaltyCard => {
  const stamps = state.loyaltyStamps.filter((stamp) => stamp.userId === userId)
  const availableStamps = stamps.filter((stamp) => stamp.redeemedAt === null).length
  const availableRewards = state.loyaltyProgram.enabled ? Math.floor(availableStamps / state.loyaltyProgram.requiredVisits) : 0
  return {
    program: state.loyaltyProgram,
    availableStamps,
    availableRewards,
    remainingToReward: state.loyaltyProgram.enabled
      ? (availableRewards > 0 ? 0 : state.loyaltyProgram.requiredVisits - availableStamps)
      : state.loyaltyProgram.requiredVisits,
    stamps: stamps.map((stamp) => ({
      id: stamp.id, appointmentId: stamp.appointmentId, createdAt: stamp.createdAt, redeemedAt: stamp.redeemedAt,
    })),
  }
}

const mockReport = (state: MockState, from: string, to: string): RevenueReport => {
  const localDate = (value: string) => {
    const parts = localParts(new Date(value), state.barbershop.timezone)
    return `${parts.year}-${parts.month}-${parts.day}`
  }
  const appointments = state.appointments.filter((item) => {
    const date = localDate(item.scheduledAt)
    return date >= from && date <= to
  })
  const done = appointments.filter((item) => item.status === 'DONE')
  const sales = state.productSales.filter((item) => {
    const date = localDate(item.createdAt)
    return date >= from && date <= to
  })
  const ranked = (items: Array<{ id: string; name: string; quantity: number; revenueCents: number }>) => {
    const grouped = new Map<string, { id: string; name: string; quantity: number; revenueCents: number }>()
    for (const item of items) {
      const current = grouped.get(item.id)
      grouped.set(item.id, current ? {
        ...current, quantity: current.quantity + item.quantity, revenueCents: current.revenueCents + item.revenueCents,
      } : item)
    }
    return [...grouped.values()].sort((left, right) => right.quantity - left.quantity || right.revenueCents - left.revenueCents)
  }
  const byBarber = barbers.map((barber) => {
    const barberAppointments = done.filter((item) => item.barberId === barber.id)
    const barberSales = sales.filter((item) => item.soldBy.id === barber.id)
    const serviceRevenueCents = barberAppointments.reduce((total, item) => total + Math.round(item.service.price * 100), 0)
    const productRevenueCents = barberSales.reduce((total, item) => total + Math.round(item.unitPrice * 100) * item.quantity, 0)
    const platformCommissionCents = barberAppointments.reduce((total, item) => total + Math.round(item.commission * 100), 0)
    return {
      barber: { id: barber.id, name: barber.name }, completedAppointments: barberAppointments.length,
      serviceRevenueCents, productsSold: barberSales.reduce((total, item) => total + item.quantity, 0),
      productRevenueCents, platformCommissionCents,
      netRevenueCents: serviceRevenueCents + productRevenueCents - platformCommissionCents,
    }
  })
  const serviceRevenueCents = done.reduce((total, item) => total + Math.round(item.service.price * 100), 0)
  const productRevenueCents = sales.reduce((total, item) => total + Math.round(item.unitPrice * 100) * item.quantity, 0)
  const platformCommissionCents = done.reduce((total, item) => total + Math.round(item.commission * 100), 0)
  return {
    period: { from, to, timezone: state.barbershop.timezone }, cashBasis: 'DONE_ONLY',
    notice: 'O faturamento considera apenas atendimentos concluídos (DONE); agendados e confirmados não são caixa.',
    byBarber,
    noShows: appointments.filter((item) => item.status === 'NO_SHOW').length,
    cancellations: appointments.filter((item) => item.status === 'CANCELLED').length,
    averageTicketCents: done.length ? Math.round(serviceRevenueCents / done.length) : 0,
    topServices: ranked(done.map((item) => ({ id: item.service.id, name: item.service.name, quantity: 1, revenueCents: Math.round(item.service.price * 100) }))),
    topProducts: ranked(sales.map((item) => ({ id: item.product.id, name: item.product.name, quantity: item.quantity, revenueCents: Math.round(item.unitPrice * 100) * item.quantity }))),
    totals: {
      completedAppointments: done.length, serviceRevenueCents,
      productsSold: sales.reduce((total, item) => total + item.quantity, 0), productRevenueCents,
      grossRevenueCents: serviceRevenueCents + productRevenueCents, platformCommissionCents,
      netRevenueCents: serviceRevenueCents + productRevenueCents - platformCommissionCents,
    },
  }
}

const dayMs = 24 * 60 * 60 * 1000

const calendarDates = (from: string, to: string): string[] | null => {
  if (!validDateOnly(from) || !validDateOnly(to)) return null
  const fromTime = Date.parse(`${from}T00:00:00.000Z`)
  const toTime = Date.parse(`${to}T00:00:00.000Z`)
  if (toTime < fromTime) return null
  return Array.from({ length: Math.floor((toTime - fromTime) / dayMs) + 1 }, (_, index) => (
    new Date(fromTime + index * dayMs).toISOString().slice(0, 10)
  ))
}
