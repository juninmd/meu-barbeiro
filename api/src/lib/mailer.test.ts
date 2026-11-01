import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createMailer } from './mailer.js'

const silent = () => {}

describe('mailer', () => {
  it('sends through Resend when the API key is configured', async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    const mailer = createMailer({
      env: { RESEND_API_KEY: 're_test', EMAIL_FROM: 'Meu Barbeiro <oi@meubarbeiro.app>' },
      log: silent,
      fetch: (async (url: string, init: { body: string }) => {
        calls.push({ url, body: JSON.parse(init.body) })
        return new Response('{}', { status: 200 })
      }) as unknown as typeof fetch,
    })

    const result = await mailer.send({ to: 'dono@barbearia.com', subject: 'Convite', text: 'olá' })
    assert.equal(result.delivered, true)
    assert.equal(result.provider, 'resend')
    assert.equal(calls[0]?.url, 'https://api.resend.com/emails')
    assert.deepEqual((calls[0]?.body as { to: string[] }).to, ['dono@barbearia.com'])
  })

  it('falls back to a generic webhook', async () => {
    const mailer = createMailer({
      env: { EMAIL_WEBHOOK_URL: 'https://hooks.example.com/mail' },
      log: silent,
      fetch: (async () => new Response('ok', { status: 202 })) as unknown as typeof fetch,
    })
    const result = await mailer.send({ to: 'a@b.com', subject: 's', text: 't' })
    assert.equal(result.provider, 'webhook')
    assert.equal(result.delivered, true)
  })

  it('never throws when the provider fails', async () => {
    const mailer = createMailer({
      env: { EMAIL_WEBHOOK_URL: 'https://hooks.example.com/mail' },
      log: silent,
      fetch: (async () => { throw new Error('connection reset') }) as unknown as typeof fetch,
    })
    const result = await mailer.send({ to: 'a@b.com', subject: 's', text: 't' })
    assert.equal(result.delivered, false)
    assert.equal(result.error, 'connection reset')
  })

  it('reports console mode without pretending to deliver', async () => {
    const lines: string[] = []
    const mailer = createMailer({ env: {}, log: (line) => lines.push(line) })
    const result = await mailer.send({ to: 'a@b.com', subject: 's', text: 't' })
    assert.deepEqual(result, { delivered: false, provider: 'console' })
    assert.match(lines[0] ?? '', /mail\.skipped/)
  })
})
