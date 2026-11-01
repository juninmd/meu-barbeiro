export interface MailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

export interface MailResult {
  delivered: boolean
  provider: string
  error?: string
}

export interface Mailer {
  send(message: MailMessage): Promise<MailResult>
}

type FetchLike = typeof fetch

export interface MailerOptions {
  env?: Record<string, string | undefined>
  fetch?: FetchLike
  timeoutMs?: number
  log?: (line: string) => void
}

/**
 * Envio de e-mail por HTTP, sem SDK.
 *
 * Ordem de preferência:
 * 1. Resend (`RESEND_API_KEY`), que já cobre o caso comum de SaaS.
 * 2. Webhook genérico (`EMAIL_WEBHOOK_URL`) para quem usa outro provedor.
 * 3. Console, para desenvolvimento: nada é enviado e o resultado diz isso.
 *
 * Falha de e-mail nunca derruba a requisição: convite continua válido e o link
 * aparece na resposta da API para ser copiado.
 */
export function createMailer(options: MailerOptions = {}): Mailer {
  const env = options.env ?? process.env
  const doFetch = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 10_000
  const log = options.log ?? ((line: string) => console.info(line))

  const from = env.EMAIL_FROM
  const resendKey = env.RESEND_API_KEY
  const webhookUrl = env.EMAIL_WEBHOOK_URL

  return {
    async send(message) {
      if (resendKey && from) {
        return post({
          provider: 'resend',
          url: 'https://api.resend.com/emails',
          headers: { authorization: `Bearer ${resendKey}` },
          body: { from, to: [message.to], subject: message.subject, text: message.text, html: message.html },
        })
      }
      if (webhookUrl) {
        return post({
          provider: 'webhook',
          url: webhookUrl,
          headers: {},
          body: { ...message, from: from ?? null },
        })
      }
      log(JSON.stringify({
        level: 'info',
        event: 'mail.skipped',
        reason: 'no-provider-configured',
        to: message.to,
        subject: message.subject,
      }))
      return { delivered: false, provider: 'console' }
    },
  }

  async function post(input: {
    provider: string
    url: string
    headers: Record<string, string>
    body: unknown
  }): Promise<MailResult> {
    try {
      const response = await doFetch(input.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...input.headers },
        body: JSON.stringify(input.body),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        log(JSON.stringify({
          level: 'warn',
          event: 'mail.failed',
          provider: input.provider,
          status: response.status,
          detail: detail.slice(0, 300),
        }))
        return { delivered: false, provider: input.provider, error: `HTTP ${response.status}` }
      }
      return { delivered: true, provider: input.provider }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      log(JSON.stringify({ level: 'warn', event: 'mail.failed', provider: input.provider, detail: message }))
      return { delivered: false, provider: input.provider, error: message }
    }
  }
}

export const mailer = createMailer()
