import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { logger } from '../lib/logger.js'

const requestIdPattern = /^[A-Za-z0-9._-]{1,64}$/

/** Identificador por requisição, propagado para logs e para o cliente. */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id')
  const requestId = incoming && requestIdPattern.test(incoming) ? incoming : randomUUID()
  res.locals.requestId = requestId
  res.setHeader('x-request-id', requestId)
  const startedAt = process.hrtime.bigint()

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'
    logger[level]('http.request', {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      userId: (req.user as { id?: string } | undefined)?.id,
    })
  })

  next()
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    message: 'Rota não encontrada',
    code: 'NOT_FOUND',
    requestId: res.locals.requestId as string | undefined,
    path: req.path,
  })
}
