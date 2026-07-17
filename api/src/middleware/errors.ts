import type { ErrorRequestHandler } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { MercadoPagoError } from '../integrations/mercado-pago.js'

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ message: 'Dados inválidos', issues: error.issues })
    return
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({ message: 'Registro já existe' })
      return
    }
    if (error.code === 'P2025') {
      res.status(404).json({ message: 'Registro não encontrado' })
      return
    }
  }

  if (error instanceof MercadoPagoError) {
    console.error('Mercado Pago request failed', { status: error.status, message: error.message })
    res.status(502).json({ message: 'Falha ao comunicar com o Mercado Pago' })
    return
  }

  console.error(error)
  res.status(500).json({ message: 'Erro interno do servidor' })
}
