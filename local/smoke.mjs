// Smoke de homologação da stack local: agendamento, pagamento mockado,
// disponibilidade, remarcação e autorização por papel.
// Uso: node local/smoke.mjs
const BASE = process.env.SMOKE_API_URL || 'http://localhost:8080/api'
const MOCK = process.env.SMOKE_MOCK_URL || 'http://localhost:4444'
let cookie = ''
let failures = 0

const call = async (path, init = {}, base = BASE) => {
  const res = await fetch(`${base}${path}`, {
    redirect: 'manual',
    ...init,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...init.headers },
  })
  const setCookie = res.headers.getSetCookie?.() ?? []
  if (setCookie.length) cookie = setCookie.map((c) => c.split(';')[0]).join('; ')
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text.slice(0, 200) }
  return { status: res.status, location: res.headers.get('location'), body }
}

const login = async (email) => { cookie = ''; return call(`/dev/login?email=${email}`) }

const step = (name, ok, detail = '') => {
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`)
}

// --- cliente ---
step('api no ar', (await call('/health')).body?.status === 'ok')
step('login mockado do Google', (await login('marina@demo.local')).status === 302)
step('sessão do cliente', (await call('/auth/me')).body?.email === 'marina@demo.local')

const services = (await call('/services')).body
const barbers = (await call('/barbers')).body
const rafael = barbers.find((b) => b.email === 'rafael@demo.local')
const corte = services.find((s) => s.name === 'Corte assinatura')
step('catálogo carregado', Boolean(rafael && corte), `${services.length} serviços, ${barbers.length} barbeiros`)

// próxima segunda-feira (barbearia abre seg-sáb)
const day = new Date()
day.setUTCDate(day.getUTCDate() + 1)
while (day.getUTCDay() !== 1) day.setUTCDate(day.getUTCDate() + 1)
const date = day.toISOString().slice(0, 10)

const availability = await call(`/appointments/availability?barberId=${rafael.id}&serviceId=${corte.id}&date=${date}`)
step('horários disponíveis', availability.status === 200 && availability.body.slots?.length > 0,
  `${availability.body.slots?.length} slots em ${date}, fuso ${availability.body.timezone}, 1º=${availability.body.slots?.[0]?.label}`)

const sunday = new Date(day)
sunday.setUTCDate(sunday.getUTCDate() - 1)
const closed = await call(`/appointments/availability?barberId=${rafael.id}&serviceId=${corte.id}&date=${sunday.toISOString().slice(0, 10)}`)
step('domingo fechado com motivo', closed.body.open === false && Boolean(closed.body.reason), closed.body.reason)

const slot = availability.body.slots[0]
const created = await call('/appointments', {
  method: 'POST',
  body: JSON.stringify({ barberId: rafael.id, serviceId: corte.id, scheduledAt: slot.scheduledAt }),
})
step('agendar no slot oferecido', created.status === 201, `pagamento=${created.body.appointment?.paymentStatus} expira=${created.body.appointment?.paymentExpiresAt}`)
step('paymentExpiresAt exposto', created.body.appointment?.paymentExpiresAt !== undefined)

const prefId = created.body.checkoutUrl?.split('/checkout/')[1]
const paid = await call(`/checkout/${prefId}/pay`, { method: 'POST' }, MOCK)
step('pagar sinal no Mercado Pago mockado', paid.status === 302 && !paid.location.includes('mockWebhook=failed'))

await new Promise((r) => setTimeout(r, 900))
const appointmentId = created.body.appointment.id
const afterPay = (await call('/appointments')).body.find((a) => a.id === appointmentId)
step('webhook aprovou o pagamento', afterPay?.paymentStatus === 'APPROVED', `valor=${afterPay?.paymentAmount} comissão=${afterPay?.commission}`)

// --- remarcação preservando o pagamento ---
const other = availability.body.slots.find((s) => s.scheduledAt !== slot.scheduledAt)
const moved = await call(`/appointments/${appointmentId}`, { method: 'PATCH', body: JSON.stringify({ scheduledAt: other.scheduledAt }) })
step('remarcar agendamento', moved.status === 200 && moved.body.scheduledAt === other.scheduledAt, `novo horário ${other.label}`)
step('remarcação preservou o pagamento', moved.body.paymentStatus === 'APPROVED' && moved.body.paymentAmount === afterPay.paymentAmount)

const sundayAt = new Date(sunday); sundayAt.setUTCHours(15, 0, 0, 0)
const invalid = await call(`/appointments/${appointmentId}`, { method: 'PATCH', body: JSON.stringify({ scheduledAt: sundayAt.toISOString() }) })
step('remarcar fora do expediente é recusado', invalid.status === 400, invalid.body?.message)

// --- autorização do barbeiro contratado ---
await login('caio@demo.local')
const denied = await call('/services', { method: 'POST', body: JSON.stringify({ name: 'Serviço Indevido', duration: 30, price: 40 }) })
step('barbeiro contratado NÃO cria serviço', denied.status === 403, `${denied.status} ${denied.body?.message}`)
const shopAsBarber = await call('/barbershops/current')
step('membershipRole exposto', shopAsBarber.body?.membershipRole === 'BARBER', String(shopAsBarber.body?.membershipRole))

// --- dono ---
await login('rafael@demo.local')
const owned = await call('/services', { method: 'POST', body: JSON.stringify({ name: 'Serviço temporário do smoke', duration: 15, price: 20 }) })
step('dono cria serviço', owned.status === 201, owned.body?.name)
// o smoke não pode deixar lixo no catálogo da barbearia
const removed = await call(`/services/${owned.body?.id}`, { method: 'DELETE' })
step('dono exclui o serviço criado', removed.status === 204)
const shopAsOwner = await call('/barbershops/current')
step('dono vê papel e assinatura', shopAsOwner.body?.membershipRole === 'OWNER' && shopAsOwner.body?.subscriptionStatus === 'ACTIVE')
const confirmed = await call(`/appointments/${appointmentId}`, { method: 'PATCH', body: JSON.stringify({ status: 'CONFIRMED' }) })
step('barbeiro confirma o agendamento', confirmed.status === 200 && confirmed.body?.status === 'CONFIRMED')

console.log(failures === 0 ? '\nTODOS OS CHECKS PASSARAM' : `\n${failures} CHECK(S) FALHARAM`)
process.exit(failures === 0 ? 0 : 1)
