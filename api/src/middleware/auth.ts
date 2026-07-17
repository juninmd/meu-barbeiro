import type { NextFunction, Request, Response } from 'express'
import type { Role, User } from '@prisma/client'

export type SessionUser = User

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: 'Autenticação necessária' })
    return
  }
  next()
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as SessionUser | undefined
    if (!user) {
      res.status(401).json({ message: 'Autenticação necessária' })
      return
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ message: 'Acesso negado' })
      return
    }
    next()
  }
}
