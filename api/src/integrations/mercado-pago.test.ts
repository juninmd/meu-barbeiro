import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { describe, it } from 'node:test'
import { MercadoPagoClient, verifyMercadoPagoSignature } from './mercado-pago.js'

describe('MercadoPagoClient', () => {
  it('creates the R$ 20 monthly SaaS subscription', async () => {
    const calls: Array<{ input: string; init: RequestInit | undefined }> = []
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push({ input: String(input), init })
      return Response.json({ id: 'subscription-1', init_point: 'https://mp.test/subscription' })
    }
    const client = new MercadoPagoClient({
      accessToken: 'platform-token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      fetch: fetchMock,
    })

    const result = await client.createSaasSubscription({
      barbershopId: 'shop-1',
      payerEmail: 'owner@example.com',
      backUrl: 'https://app.example.com/settings/billing',
    })

    assert.equal(result.id, 'subscription-1')
    assert.equal(result.initPoint, 'https://mp.test/subscription')
    assert.equal(calls[0]?.input, 'https://api.mercadopago.com/preapproval')
    assert.equal(new Headers(calls[0]?.init?.headers).get('authorization'), 'Bearer platform-token')
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
      reason: 'Meu Barbeiro - assinatura mensal',
      external_reference: 'shop-1',
      payer_email: 'owner@example.com',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 20,
        currency_id: 'BRL',
      },
      back_url: 'https://app.example.com/settings/billing',
    })
  })

  it('authorizes a seller with OAuth PKCE without exposing credentials', async () => {
    const calls: Array<{ input: string; init: RequestInit | undefined }> = []
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push({ input: String(input), init })
      return Response.json({
        access_token: 'seller-access',
        refresh_token: 'seller-refresh',
        expires_in: 15_552_000,
        user_id: 12345,
      })
    }
    const client = new MercadoPagoClient({
      accessToken: 'platform-token', clientId: 'client-id', clientSecret: 'client-secret', fetch: fetchMock,
    })
    const authorizationUrl = client.sellerAuthorizationUrl({
      redirectUri: 'https://app.example.com/api/billing/mercado-pago/callback',
      state: 'unpredictable-state',
      codeChallenge: 'pkce-challenge',
    })

    const parsed = new URL(authorizationUrl)
    assert.equal(parsed.origin + parsed.pathname, 'https://auth.mercadopago.com/authorization')
    assert.equal(parsed.searchParams.get('client_id'), 'client-id')
    assert.equal(parsed.searchParams.get('state'), 'unpredictable-state')
    assert.equal(parsed.searchParams.get('code_challenge'), 'pkce-challenge')
    assert.equal(parsed.searchParams.get('code_challenge_method'), 'S256')
    assert.equal(authorizationUrl.includes('client-secret'), false)

    const tokens = await client.exchangeSellerAuthorization({
      code: 'authorization-code',
      redirectUri: 'https://app.example.com/api/billing/mercado-pago/callback',
      codeVerifier: 'pkce-verifier',
    })
    assert.deepEqual(tokens, {
      accessToken: 'seller-access', refreshToken: 'seller-refresh', expiresIn: 15_552_000, sellerId: '12345',
    })
    assert.equal(calls[0]?.input, 'https://api.mercadopago.com/oauth/token')
  })

  it('creates a signal checkout and charges 1% of the full service value', async () => {
    const calls: Array<{ input: string; init: RequestInit | undefined }> = []
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push({ input: String(input), init })
      return Response.json({ id: 'preference-1', init_point: 'https://mp.test/pay' })
    }
    const client = new MercadoPagoClient({
      accessToken: 'platform-token', clientId: 'client-id', clientSecret: 'client-secret', fetch: fetchMock,
    })

    const checkout = await client.createMarketplaceCheckout({
      sellerAccessToken: 'seller-token',
      appointmentId: 'appointment-1',
      serviceName: 'Corte + barba',
      servicePriceCents: 8_500,
      depositPolicy: { type: 'PERCENTAGE', value: 30 },
      payerEmail: 'customer@example.com',
      frontendBaseUrl: 'https://app.example.com',
      webhookUrl: 'https://api.example.com/billing/mercado-pago/webhook',
    })

    assert.deepEqual(checkout, { id: 'preference-1', initPoint: 'https://mp.test/pay', amountCents: 2_550, commissionCents: 85 })
    assert.equal(calls[0]?.input, 'https://api.mercadopago.com/checkout/preferences')
    assert.equal(new Headers(calls[0]?.init?.headers).get('authorization'), 'Bearer seller-token')
    assert.equal(new Headers(calls[0]?.init?.headers).get('x-idempotency-key'), 'appointment-1')
    const body = JSON.parse(String(calls[0]?.init?.body))
    assert.equal(body.items[0].unit_price, 25.5)
    assert.equal(body.marketplace_fee, 0.85)
    assert.equal(body.external_reference, 'appointment-1')
  })

  it('accepts only authentic Mercado Pago webhook signatures', () => {
    const secret = 'webhook-secret'
    const manifest = 'id:payment-1;request-id:request-1;ts:1704908010;'
    const digest = createHmac('sha256', secret).update(manifest).digest('hex')
    const signature = `ts=1704908010,v1=${digest}`

    assert.equal(verifyMercadoPagoSignature({ signature, requestId: 'request-1', dataId: 'payment-1', secret }), true)
    assert.equal(verifyMercadoPagoSignature({ signature, requestId: 'request-1', dataId: 'tampered', secret }), false)
    assert.equal(verifyMercadoPagoSignature({ signature: 'invalid', requestId: 'request-1', dataId: 'payment-1', secret }), false)
  })
})
