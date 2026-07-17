import type { Barbershop, BusinessHour, Membership } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      barbershop?: Barbershop & { businessHours: BusinessHour[] }
      membership?: Membership
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    mercadoPagoOAuth?: {
      barbershopId: string
      state: string
      codeVerifier: string
      createdAt: number
    }
  }
}

export {}
