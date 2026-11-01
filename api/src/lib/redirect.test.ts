import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { safeReturnPath } from './redirect.js'

describe('safeReturnPath', () => {
  it('keeps local paths', () => {
    assert.equal(safeReturnPath('/convite/abc'), '/convite/abc')
    assert.equal(safeReturnPath('/barbeiro/hoje?x=1'), '/barbeiro/hoje?x=1')
  })

  it('rejects absolute and protocol-relative URLs', () => {
    assert.equal(safeReturnPath('https://evil.example.com'), '/')
    assert.equal(safeReturnPath('//evil.example.com'), '/')
    assert.equal(safeReturnPath('/\\evil.example.com'), '/')
    assert.equal(safeReturnPath('javascript:alert(1)'), '/')
  })

  it('rejects header injection and huge values', () => {
    assert.equal(safeReturnPath('/a\r\nSet-Cookie: x=1'), '/')
    assert.equal(safeReturnPath(`/${'a'.repeat(400)}`), '/')
    assert.equal(safeReturnPath(undefined), '/')
  })
})
