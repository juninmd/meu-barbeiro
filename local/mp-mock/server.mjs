import { createHmac, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'

const PORT = Number(process.env.PORT || 4444)
const PUBLIC_URL = process.env.MOCK_PUBLIC_URL || `http://localhost:${PORT}`
const API_INTERNAL_URL = process.env.MOCK_API_INTERNAL_URL || 'http://api:3333'
const WEBHOOK_SECRET = process.env.MERCADO_PAGO_WEBHOOK_SECRET || 'mock-webhook-secret'
const SELLER_ID = process.env.MOCK_SELLER_ID || '123456789'

const preferences = new Map()
const subscriptions = new Map()
const payments = new Map()

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

const html = (res, body) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(`<!doctype html><meta charset="utf-8"><title>Mercado Pago (mock)</title>
<style>body{font-family:system-ui;background:#111;color:#eee;display:grid;place-items:center;height:100vh;margin:0}
.card{background:#1c1c1c;padding:32px;border-radius:16px;max-width:420px;width:90%}
h1{font-size:18px;margin:0 0 4px}p{color:#aaa;font-size:14px}
a,button{display:block;width:100%;padding:12px;margin-top:8px;border-radius:10px;border:0;font-size:15px;text-align:center;text-decoration:none;cursor:pointer}
.ok{background:#00a650;color:#fff}.no{background:#333;color:#eee}</style>${body}`)
}

const readBody = (req) => new Promise((resolve) => {
  let raw = ''
  req.on('data', (chunk) => { raw += chunk })
  req.on('end', () => {
    try { resolve(raw ? JSON.parse(raw) : {}) } catch { resolve({}) }
  })
})

async function sendWebhook(type, dataId, extra = {}) {
  const requestId = randomUUID()
  const ts = String(Math.floor(Date.now() / 1000))
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`
  const v1 = createHmac('sha256', WEBHOOK_SECRET).update(manifest).digest('hex')
  const response = await fetch(`${API_INTERNAL_URL}/billing/mercado-pago/webhook?data.id=${dataId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId,
      'x-signature': `ts=${ts},v1=${v1}`,
    },
    body: JSON.stringify({ id: randomUUID(), type, action: `${type}.updated`, data: { id: String(dataId) }, ...extra }),
  }).catch((error) => ({ ok: false, status: 0, statusText: error.message }))
  console.log(`[mp-mock] webhook ${type} ${dataId} -> ${response.status} ${response.ok ? 'ok' : response.statusText || 'fail'}`)
  return response.ok
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, PUBLIC_URL)
  const path = url.pathname
  const method = req.method || 'GET'
  console.log(`[mp-mock] ${method} ${path}`)

  // --- OAuth do vendedor (marketplace) ---
  if (path === '/authorization' && method === 'GET') {
    const redirectUri = url.searchParams.get('redirect_uri') || ''
    const state = url.searchParams.get('state') || ''
    const target = `${redirectUri}?code=mock-auth-code&state=${encodeURIComponent(state)}`
    return html(res, `<div class="card"><h1>Autorizar Meu Barbeiro</h1>
<p>Ambiente simulado. Nenhuma cobrança real acontece.</p>
<a class="ok" href="${target}">Autorizar conta do vendedor</a></div>`)
  }

  if (path === '/oauth/token' && method === 'POST') {
    return json(res, 200, {
      access_token: `mock-seller-access-${randomUUID()}`,
      refresh_token: `mock-seller-refresh-${randomUUID()}`,
      expires_in: 15_552_000,
      user_id: SELLER_ID,
    })
  }

  // --- Assinatura SaaS ---
  if (path === '/preapproval' && method === 'POST') {
    const body = await readBody(req)
    const id = `preapproval-${randomUUID()}`
    subscriptions.set(id, { id, status: 'pending', external_reference: body.external_reference ?? null })
    return json(res, 201, { id, init_point: `${PUBLIC_URL}/checkout/subscription/${id}` })
  }

  if (path.startsWith('/preapproval/') && method === 'GET') {
    const id = decodeURIComponent(path.slice('/preapproval/'.length))
    const subscription = subscriptions.get(id)
    if (!subscription) return json(res, 404, { message: 'Assinatura não encontrada' })
    return json(res, 200, subscription)
  }

  if (path.startsWith('/checkout/subscription/') && method === 'GET') {
    const id = decodeURIComponent(path.slice('/checkout/subscription/'.length))
    if (!subscriptions.has(id)) return json(res, 404, { message: 'Assinatura não encontrada' })
    return html(res, `<div class="card"><h1>Assinatura Meu Barbeiro</h1>
<p>R$ 20,00/mês · ambiente simulado</p>
<form method="POST" action="/checkout/subscription/${encodeURIComponent(id)}/authorize">
<button class="ok" type="submit">Autorizar assinatura</button></form></div>`)
  }

  if (path.startsWith('/checkout/subscription/') && path.endsWith('/authorize') && method === 'POST') {
    const id = decodeURIComponent(path.slice('/checkout/subscription/'.length, -'/authorize'.length))
    const subscription = subscriptions.get(id)
    if (!subscription) return json(res, 404, { message: 'Assinatura não encontrada' })
    subscription.status = 'authorized'
    await sendWebhook('subscription_preapproval', id)
    res.writeHead(302, { location: `${process.env.MOCK_FRONTEND_URL || 'http://localhost:8080'}/?subscription=return` })
    return res.end()
  }

  // --- Checkout de sinal do agendamento ---
  if (path === '/checkout/preferences' && method === 'POST') {
    const body = await readBody(req)
    const id = `pref-${randomUUID()}`
    preferences.set(id, {
      id,
      external_reference: body.external_reference ?? null,
      amount: body.items?.[0]?.unit_price ?? 0,
      title: body.items?.[0]?.title ?? 'Serviço',
      backUrls: body.back_urls ?? {},
    })
    return json(res, 201, { id, init_point: `${PUBLIC_URL}/checkout/${id}` })
  }

  if (path.startsWith('/checkout/') && method === 'GET') {
    const id = decodeURIComponent(path.slice('/checkout/'.length))
    const preference = preferences.get(id)
    if (!preference) return json(res, 404, { message: 'Preferência não encontrada' })
    const escaped = encodeURIComponent(id)
    return html(res, `<div class="card"><h1>${preference.title}</h1>
<p>Sinal de R$ ${preference.amount.toFixed(2).replace('.', ',')} · ambiente simulado</p>
<form method="POST" action="/checkout/${escaped}/pay"><input type="hidden" name="status" value="approved">
<button class="ok" type="submit" data-testid="mp-approve">Pagar agora</button></form>
<form method="POST" action="/checkout/${escaped}/pay?status=rejected">
<button class="no" type="submit" data-testid="mp-reject">Recusar pagamento</button></form></div>`)
  }

  if (path.startsWith('/checkout/') && path.endsWith('/pay') && method === 'POST') {
    const id = decodeURIComponent(path.slice('/checkout/'.length, -'/pay'.length))
    const preference = preferences.get(id)
    if (!preference) return json(res, 404, { message: 'Preferência não encontrada' })
    const status = url.searchParams.get('status') === 'rejected' ? 'rejected' : 'approved'
    const paymentId = String(Date.now())
    payments.set(paymentId, {
      id: paymentId,
      status,
      external_reference: preference.external_reference,
      transaction_amount: preference.amount,
    })
    const delivered = await sendWebhook('payment', paymentId, { user_id: SELLER_ID })
    const back = status === 'approved' ? preference.backUrls.success : preference.backUrls.failure
    const target = new URL(back || `${process.env.MOCK_FRONTEND_URL || 'http://localhost:8080'}/`)
    target.searchParams.set('mockWebhook', delivered ? 'delivered' : 'failed')
    res.writeHead(302, { location: target.toString() })
    return res.end()
  }

  if (path.startsWith('/v1/payments/') && path.endsWith('/refunds') && method === 'POST') {
    const paymentId = decodeURIComponent(path.slice('/v1/payments/'.length, -'/refunds'.length))
    const payment = payments.get(paymentId)
    if (payment) payment.status = 'refunded'
    return json(res, 201, { id: `refund-${randomUUID()}` })
  }

  if (path.startsWith('/v1/payments/') && method === 'GET') {
    const paymentId = decodeURIComponent(path.slice('/v1/payments/'.length))
    const payment = payments.get(paymentId)
    if (!payment) return json(res, 404, { message: 'Pagamento não encontrado' })
    return json(res, 200, payment)
  }

  if (path === '/health') return json(res, 200, { status: 'ok' })

  // evita 404 no console durante a homologação
  if (path === '/favicon.ico') {
    res.writeHead(204)
    return res.end()
  }

  return json(res, 404, { message: `Rota simulada inexistente: ${method} ${path}` })
})

server.listen(PORT, () => console.log(`[mp-mock] ouvindo em ${PUBLIC_URL}`))
