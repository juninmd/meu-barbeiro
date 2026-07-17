import axios from 'axios'
import type {
  Appointment,
  AppointmentCheckout,
  AppointmentStatus,
  Barber,
  Barbershop,
  NewAppointment,
  NewService,
  Role,
  Service,
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
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message || fallback
  return error instanceof Error ? error.message : fallback
}

const customer: User = {
  id: 'customer-demo',
  name: 'Marina Costa',
  email: 'marina@demo.local',
  role: 'CUSTOMER',
}

const barbers: Barber[] = [
  { id: 'barber-demo', name: 'Rafael Navalha', email: 'rafael@demo.local', role: 'BARBER', specialty: 'Clássicos & barba' },
  { id: 'barber-2', name: 'Caio Santos', email: 'caio@demo.local', role: 'BARBER', specialty: 'Degradê & freestyle' },
]

const initialServices: Service[] = [
  { id: 'service-cut', name: 'Corte assinatura', duration: 45, price: 55 },
  { id: 'service-beard', name: 'Barba terapêutica', duration: 30, price: 38 },
  { id: 'service-combo', name: 'Corte + barba', duration: 75, price: 85 },
]

interface MockState {
  barbershop: Barbershop
  services: Service[]
  appointments: Appointment[]
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
  subscriptionStatus: 'ACTIVE',
  mercadoPagoConnected: true,
  businessHours: Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    opensAt: '09:00',
    closesAt: '20:00',
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
  appointments: [
    {
      id: 'appointment-1',
      userId: customer.id,
      barberId: barbers[0].id,
      serviceId: initialServices[2].id,
      scheduledAt: futureAt(0, 14),
      status: 'CONFIRMED',
      paymentStatus: 'APPROVED',
      paymentAmount: 85,
      commission: 0.85,
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
      paymentAmount: 55,
      commission: 0.55,
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
      paymentAmount: 38,
      commission: 0.38,
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
    return JSON.parse(stored) as MockState
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

const selectedMockUser = (role: Role): User => role === 'BARBER' ? barbers[0] : customer

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
    if (mockEnabled) return readState().services
    return (await api.get<Service[]>('/services')).data
  },

  async barbershop(): Promise<Barbershop> {
    if (mockEnabled) return readState().barbershop
    return (await api.get<Barbershop>('/barbershops/current')).data
  },

  async updateBarbershop(input: Barbershop): Promise<Barbershop> {
    if (!mockEnabled) return (await api.patch<Barbershop>('/barbershops/current', input)).data
    const state = readState()
    state.barbershop = { ...state.barbershop, ...input }
    writeState(state)
    return state.barbershop
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

  async appointments(user: User): Promise<Appointment[]> {
    if (mockEnabled) {
      const items = readState().appointments
      return items.filter((item) => user.role === 'BARBER' ? item.barberId === user.id : item.userId === user.id)
    }
    return (await api.get<Appointment[]>('/appointments')).data
  },

  async createAppointment(input: NewAppointment): Promise<AppointmentCheckout> {
    if (!mockEnabled) return (await api.post<AppointmentCheckout>('/appointments', input)).data

    const state = readState()
    const barber = barbers.find((item) => item.id === input.barberId)
    const service = state.services.find((item) => item.id === input.serviceId)
    if (!barber || !service) throw new Error('Serviço ou barbeiro inválido')
    const scheduledAt = new Date(input.scheduledAt)
    if (Number.isNaN(scheduledAt.getTime())) throw new Error('Horário inválido')
    if (scheduledAt.getTime() <= Date.now()) throw new Error('Horário deve estar no futuro')
    const configuredHours = state.barbershop.businessHours.find((item) => item.weekday === scheduledAt.getDay())
    const startAt = scheduledAt.getHours() * 60 + scheduledAt.getMinutes()
    const [opensHour = 0, opensMinute = 0] = configuredHours?.opensAt.split(':').map(Number) ?? []
    const [closesHour = 0, closesMinute = 0] = configuredHours?.closesAt.split(':').map(Number) ?? []
    const opensAt = opensHour * 60 + opensMinute
    const closesAt = closesHour * 60 + closesMinute
    if (!configuredHours?.enabled || startAt < opensAt || startAt + service.duration > closesAt) {
      throw new Error(configuredHours?.enabled
        ? `Escolha um horário entre ${configuredHours.opensAt} e ${configuredHours.closesAt}`
        : 'A barbearia não atende neste dia')
    }
    const conflict = state.appointments.some((item) => {
      if (item.barberId !== barber.id || !['PENDING', 'CONFIRMED'].includes(item.status)) return false
      const existingStart = new Date(item.scheduledAt).getTime()
      const existingEnd = existingStart + item.service.duration * 60_000
      const requestedStart = scheduledAt.getTime()
      const requestedEnd = requestedStart + service.duration * 60_000
      return existingStart < requestedEnd && requestedStart < existingEnd
    })
    if (conflict) throw new Error('Este horário acabou de ser reservado')
    const appointment: Appointment = {
      id: crypto.randomUUID(),
      userId: customer.id,
      ...input,
      status: 'PENDING',
      paymentStatus: state.barbershop.depositType === 'NONE' ? 'NOT_REQUIRED' : 'APPROVED',
      paymentAmount: depositAmount(service.price, state.barbershop),
      commission: state.barbershop.depositType === 'NONE' ? 0 : commissionAmount(service.price, state.barbershop),
      user: customer,
      barber,
      service,
    }
    state.appointments.push(appointment)
    writeState(state)
    return { appointment, checkoutUrl: null }
  },

  async updateAppointment(id: string, status: AppointmentStatus): Promise<Appointment> {
    if (!mockEnabled) return (await api.patch<Appointment>(`/appointments/${id}`, { status })).data

    const state = readState()
    const appointment = state.appointments.find((item) => item.id === id)
    if (!appointment) throw new Error('Agendamento não encontrado')
    const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['DONE', 'CANCELLED'],
      CANCELLED: [],
      DONE: [],
    }
    if (!transitions[appointment.status].includes(status)) throw new Error('Este agendamento não permite essa alteração')
    appointment.status = status
    writeState(state)
    return appointment
  },

  async createService(input: NewService): Promise<Service> {
    if (!mockEnabled) return (await api.post<Service>('/services', input)).data

    const state = readState()
    const service = { id: crypto.randomUUID(), ...input }
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
    if (state.appointments.some((item) => item.serviceId === id && item.status !== 'CANCELLED')) {
      throw new Error('Serviço possui agendamentos ativos')
    }
    state.services = state.services.filter((item) => item.id !== id)
    writeState(state)
  },
}
