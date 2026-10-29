import type { NextFunction, Request, Response } from 'express'

interface Bucket { count: number; resetsAt: number }

/** Limitador em memória por chave. Suficiente para uma instância; atrás de vários pods use o ingress. */
export function rateLimit(options: { windowMs: number; max: number; key: (req: Request) => string; message?: string }) {
  const buckets = new Map<string, Bucket>()
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now()
    if (buckets.size > 10_000) {
      for (const [key, bucket] of buckets) if (bucket.resetsAt <= now) buckets.delete(key)
    }
    const key = options.key(req)
    const bucket = buckets.get(key)
    if (!bucket || bucket.resetsAt <= now) {
      buckets.set(key, { count: 1, resetsAt: now + options.windowMs })
      next()
      return
    }
    bucket.count += 1
    if (bucket.count > options.max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetsAt - now) / 1000)))
      res.status(429).json({ message: options.message ?? 'Muitas tentativas. Aguarde alguns minutos.' })
      return
    }
    next()
  }
}
