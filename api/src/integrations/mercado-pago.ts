import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  DEFAULT_MONTHLY_FEE_CENTS,
  calculateCommissionCents,
  calculateDepositCents,
  type DepositPolicy,
} from '../domain/billing.js'

const API_URL = process.env.MERCADO_PAGO_API_URL || 'https://api.mercadopago.com'
const AUTH_URL = process.env.MERCADO_PAGO_AUTH_URL || 'https://auth.mercadopago.com'

export function verifyMercadoPagoSignature(input: {
  signature: string
  requestId: string
  dataId: string
  secret: string
}): boolean {
  const parts = Object.fromEntries(input.signature.split(',').map((part) => part.split('=', 2)))
  const timestamp = parts.ts
  const received = parts.v1
  if (!timestamp || !received || !/^[a-f\d]{64}$/i.test(received)) return false

  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.requestId};ts:${timestamp};`
  const expected = createHmac('sha256', input.secret).update(manifest).digest('hex')
  return timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'))
}

interface MercadoPagoClientOptions {
  accessToken: string
  clientId: string
  clientSecret: string
  fetch?: typeof fetch
}

interface MercadoPagoErrorBody {
  message?: string
  error?: string
}

export class MercadoPagoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export class MercadoPagoClient {
  private readonly fetch: typeof fetch

  constructor(private readonly options: MercadoPagoClientOptions) {
    this.fetch = options.fetch ?? globalThis.fetch
  }

  sellerAuthorizationUrl(input: {
    redirectUri: string
    state: string
    codeChallenge: string
  }): string {
    const url = new URL(`${AUTH_URL}/authorization`)
    url.search = new URLSearchParams({
      client_id: this.options.clientId,
      response_type: 'code',
      platform_id: 'mp',
      redirect_uri: input.redirectUri,
      state: input.state,
      code_challenge: input.codeChallenge,
      code_challenge_method: 'S256',
    }).toString()
    return url.toString()
  }

  async exchangeSellerAuthorization(input: {
    code: string
    redirectUri: string
    codeVerifier: string
  }): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; sellerId: string }> {
    const response = await this.fetch(`${API_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: this.options.clientId,
        client_secret: this.options.clientSecret,
        grant_type: 'authorization_code',
        code: input.code,
        redirect_uri: input.redirectUri,
        code_verifier: input.codeVerifier,
      }),
    })
    if (!response.ok) await this.throwResponseError(response)
    const data = await response.json() as {
      access_token: string
      refresh_token: string
      expires_in: number
      user_id: number | string
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      sellerId: String(data.user_id),
    }
  }

  async refreshSellerAuthorization(refreshToken: string): Promise<{
    accessToken: string
    refreshToken: string
    expiresIn: number
    sellerId: string
  }> {
    const response = await this.fetch(`${API_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: this.options.clientId,
        client_secret: this.options.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })
    if (!response.ok) await this.throwResponseError(response)
    const data = await response.json() as {
      access_token: string
      refresh_token: string
      expires_in: number
      user_id: number | string
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      sellerId: String(data.user_id),
    }
  }

  async createSaasSubscription(input: {
    barbershopId: string
    payerEmail: string
    backUrl: string
  }): Promise<{ id: string; initPoint: string }> {
    const response = await this.request<{ id: string; init_point: string }>('/preapproval', {
      method: 'POST',
      body: JSON.stringify({
        reason: 'Meu Barbeiro - assinatura mensal',
        external_reference: input.barbershopId,
        payer_email: input.payerEmail,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: DEFAULT_MONTHLY_FEE_CENTS / 100,
          currency_id: 'BRL',
        },
        back_url: input.backUrl,
      }),
    })
    return { id: response.id, initPoint: response.init_point }
  }

  async createMarketplaceCheckout(input: {
    sellerAccessToken: string
    appointmentId: string
    serviceName: string
    servicePriceCents: number
    depositPolicy: DepositPolicy
    payerEmail?: string
    frontendBaseUrl: string
    webhookUrl: string
    expiresAt?: Date
  }): Promise<{ id: string; initPoint: string; amountCents: number; commissionCents: number }> {
    const amountCents = calculateDepositCents(input.servicePriceCents, input.depositPolicy)
    const commissionCents = calculateCommissionCents(input.servicePriceCents)
    if (amountCents <= 0) throw new Error('Este agendamento não exige pagamento antecipado')
    if (commissionCents > amountCents) throw new Error('O sinal não pode ser menor que a comissão da plataforma')

    const response = await this.request<{ id: string; init_point: string }>('/checkout/preferences', {
      method: 'POST',
      headers: { 'x-idempotency-key': input.appointmentId },
      body: JSON.stringify({
        items: [{
          id: input.appointmentId,
          title: input.serviceName,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: amountCents / 100,
        }],
        ...(input.payerEmail ? { payer: { email: input.payerEmail } } : {}),
        marketplace_fee: commissionCents / 100,
        external_reference: input.appointmentId,
        notification_url: input.webhookUrl,
        back_urls: {
          success: `${input.frontendBaseUrl}/?payment=success`,
          pending: `${input.frontendBaseUrl}/?payment=pending`,
          failure: `${input.frontendBaseUrl}/?payment=failure`,
        },
        auto_return: 'approved',
        ...(input.expiresAt ? {
          expires: true,
          expiration_date_from: new Date().toISOString(),
          expiration_date_to: input.expiresAt.toISOString(),
        } : {}),
      }),
    }, input.sellerAccessToken)
    return { id: response.id, initPoint: response.init_point, amountCents, commissionCents }
  }

  getPayment(paymentId: string, sellerAccessToken: string): Promise<{
    id: number | string
    status: string
    external_reference: string | null
    transaction_amount: number
  }> {
    return this.request(`/v1/payments/${encodeURIComponent(paymentId)}`, { method: 'GET' }, sellerAccessToken)
  }

  getSubscription(subscriptionId: string): Promise<{
    id: string
    status: string
    external_reference: string | null
  }> {
    return this.request(`/preapproval/${encodeURIComponent(subscriptionId)}`, { method: 'GET' })
  }

  refundPayment(paymentId: string, sellerAccessToken: string, idempotencyKey: string): Promise<{ id: number | string }> {
    return this.request(`/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
      method: 'POST',
      headers: { 'x-idempotency-key': idempotencyKey },
      body: '{}',
    }, sellerAccessToken)
  }

  private async request<T>(path: string, init: RequestInit, accessToken = this.options.accessToken): Promise<T> {
    const response = await this.fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
        ...init.headers,
      },
    })
    if (!response.ok) await this.throwResponseError(response)
    return response.json() as Promise<T>
  }

  private async throwResponseError(response: Response): Promise<never> {
    const body = await response.json().catch(() => ({})) as MercadoPagoErrorBody
    throw new MercadoPagoError(body.message || body.error || 'Mercado Pago indisponível', response.status)
  }
}
