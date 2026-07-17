import type { ErrorRequestHandler } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'

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

  console.error(error)
  res.status(500).json({ message: 'Erro interno do servidor' })
}
