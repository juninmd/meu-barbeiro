import assert from 'node:assert/strict'
import test from 'node:test'
import { logoUrlField, timezoneField } from './settings-fields.js'

test('timezone rejects unknown zones and accepts IANA names', () => {
  for (const bad of ['Nowhere/Land', 'America/Sao Paulo', '']) {
    assert.equal(timezoneField.safeParse(bad).success, false, bad)
  }
  for (const ok of ['America/Sao_Paulo', 'UTC', 'America/Manaus']) {
    assert.equal(timezoneField.safeParse(ok).success, true, ok)
  }
})

test('logoUrl only accepts https, empty or null', () => {
  for (const bad of ['http://x.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'https://u:p@x.com/a.png', 'https://x.com:8443/a.png']) {
    assert.equal(logoUrlField.safeParse(bad).success, false, bad)
  }
  for (const ok of ['https://cdn.exemplo.invalid/logo.png', '', null]) {
    assert.equal(logoUrlField.safeParse(ok).success, true, String(ok))
  }
})
