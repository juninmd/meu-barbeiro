import session, { type SessionData } from 'express-session'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000

export class PrismaSessionStore extends session.Store {
  get(sid: string, callback: (error: unknown, session?: SessionData | null) => void): void {
    void prisma.session.findUnique({ where: { sid } })
      .then(async (stored) => {
        if (!stored) return callback(null, null)
        if (stored.expiresAt <= new Date()) {
          await prisma.session.delete({ where: { sid } }).catch(() => undefined)
          return callback(null, null)
        }
        callback(null, stored.data as unknown as SessionData)
      })
      .catch(callback)
  }

  set(sid: string, value: SessionData, callback?: (error?: unknown) => void): void {
    const expiresAt = value.cookie.expires
      ? new Date(value.cookie.expires)
      : new Date(Date.now() + (value.cookie.maxAge ?? DEFAULT_TTL_MS))
    const data = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue

    void prisma.session.upsert({
      where: { sid },
      update: { data, expiresAt },
      create: { sid, data, expiresAt },
    }).then(() => callback?.()).catch((error) => callback?.(error))
  }

  destroy(sid: string, callback?: (error?: unknown) => void): void {
    void prisma.session.deleteMany({ where: { sid } })
      .then(() => callback?.())
      .catch((error) => callback?.(error))
  }

  touch(sid: string, value: SessionData, callback?: (error?: unknown) => void): void {
    this.set(sid, value, callback)
  }
}
