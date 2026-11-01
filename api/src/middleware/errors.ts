import type { ErrorRequestHandler } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { MercadoPagoError } from '../integrations/mercado-pago.js'
import { logger } from '../lib/logger.js'

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = res.locals.requestId as string | undefined

  if (error instanceof ZodError) {
    res.status(400).json({ message: 'Dados inválidos', code: 'VALIDATION_ERROR', issues: error.issues, requestId })
    return
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({ message: 'Registro já existe', code: 'CONFLICT', requestId })
      return
    }
    if (error.code === 'P2025') {
      res.status(404).json({ message: 'Registro não encontrado', code: 'NOT_FOUND', requestId })
      return
    }
  }

  if (error instanceof MercadoPagoError) {
    logger.error('mercado-pago.failed', { requestId, status: error.status, message: error.message })
    res.status(502).json({ message: 'Falha ao comunicar com o Mercado Pago', code: 'PAYMENT_PROVIDER_ERROR', requestId })
    return
  }

  logger.error('http.unhandled', {
    requestId,
    method: req.method,
    path: req.path,
    error,
  })
  res.status(500).json({
    message: 'Erro interno do servidor',
    code: 'INTERNAL_ERROR',
    requestId,
  })
}
