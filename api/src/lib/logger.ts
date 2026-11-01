type Level = 'info' | 'warn' | 'error'

const order: Record<Level, number> = { info: 0, warn: 1, error: 2 }

function threshold(): Level {
  const configured = process.env.LOG_LEVEL
  if (configured === 'error') return 'error'
  if (configured === 'warn') return 'warn'
  return 'info'
}

function serialise(error: unknown): unknown {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack }
  }
  return error
}

/**
 * Log estruturado em uma linha por evento, pronto para Loki/CloudWatch.
 * Nunca inclui corpo de requisição: só metadados.
 */
export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  if (order[level] < order[threshold()]) return
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
    ...(fields.error !== undefined ? { error: serialise(fields.error) } : {}),
  }
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  info: (event: string, fields?: Record<string, unknown>) => log('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => log('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => log('error', event, fields),
}
