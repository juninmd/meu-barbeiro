import { prisma } from './prisma.js'
import { logger } from './logger.js'

export interface AuditInput {
  actorId?: string | null
  barbershopId?: string | null
  action: string
  target?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Trilha de auditoria para ações sensíveis de plataforma e de equipe.
 * Falha de auditoria é registrada, mas nunca desfaz a ação do usuário.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        barbershopId: input.barbershopId ?? null,
        action: input.action,
        target: input.target ?? null,
        metadata: (input.metadata ?? {}) as never,
      },
    })
  } catch (error) {
    logger.warn('audit.write-failed', { action: input.action, error })
  }
}
