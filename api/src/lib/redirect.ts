/**
 * Só aceita caminho relativo do próprio app como destino pós-login.
 * Evita open redirect em `?returnTo=`.
 */
export function safeReturnPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') return fallback
  const path = value.trim()
  if (path.length === 0 || path.length > 300) return fallback
  if (!path.startsWith('/')) return fallback
  if (path.startsWith('//') || path.startsWith('/\\')) return fallback
  if (path.includes('\\') || path.includes('\n') || path.includes('\r')) return fallback
  return path
}
