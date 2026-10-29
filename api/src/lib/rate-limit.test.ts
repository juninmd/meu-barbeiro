import assert from 'node:assert/strict'
import test from 'node:test'
import type { NextFunction, Request, Response } from 'express'
import { rateLimit } from './rate-limit.js'

const call = (limiter: ReturnType<typeof rateLimit>, key: string) => {
  let status = 200
  let passed = false
  const res = {
    setHeader: () => undefined,
    status(code: number) { status = code; return this },
    json: () => undefined,
  } as unknown as Response
  limiter({ key } as unknown as Request, res, (() => { passed = true }) as NextFunction)
  return { status, passed }
}

test('blocks after max attempts per key and keeps other keys free', () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 2, key: (req) => (req as unknown as { key: string }).key })
  assert.equal(call(limiter, 'a').passed, true)
  assert.equal(call(limiter, 'a').passed, true)
  const blocked = call(limiter, 'a')
  assert.equal(blocked.passed, false)
  assert.equal(blocked.status, 429)
  assert.equal(call(limiter, 'b').passed, true)
})
