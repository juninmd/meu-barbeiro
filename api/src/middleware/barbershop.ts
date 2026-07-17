import type { MembershipRole } from '@prisma/client'
import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import type { SessionUser } from './auth.js'

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function resolveBarbershop(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const slug = req.header('x-barbershop-slug') || process.env.DEFAULT_BARBERSHOP_SLUG || 'barbearia-central'
    if (!slugPattern.test(slug)) {
      res.status(400).json({ message: 'Identificador da barbearia inválido' })
      return
    }
    const barbershop = await prisma.barbershop.findUnique({
      where: { slug },
      include: { businessHours: { orderBy: { weekday: 'asc' } } },
    })
    if (!barbershop) {
      res.status(404).json({ message: 'Barbearia não encontrada' })
      return
    }
    req.barbershop = barbershop
    next()
  } catch (error) {
    next(error)
  }
}

export function requireBarbershopRole(...roles: MembershipRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user as SessionUser | undefined
      if (!user) {
        res.status(401).json({ message: 'Autenticação necessária' })
        return
      }
      if (!req.barbershop) {
        res.status(500).json({ message: 'Contexto da barbearia ausente' })
        return
      }
      const membership = await prisma.membership.findUnique({
        where: { barbershopId_userId: { barbershopId: req.barbershop.id, userId: user.id } },
      })
      if (!membership || !roles.includes(membership.role)) {
        res.status(403).json({ message: 'Acesso negado para esta barbearia' })
        return
      }
      req.membership = membership
      next()
    } catch (error) {
      next(error)
    }
  }
}
