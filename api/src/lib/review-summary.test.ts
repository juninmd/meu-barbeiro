import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeReviews } from './review-summary.js'

test('summarizes ratings with one decimal and a distribution', () => {
  const summary = summarizeReviews([5, 5, 4, 1])
  assert.equal(summary.count, 4)
  assert.equal(summary.average, 3.8)
  assert.deepEqual(summary.distribution, { 1: 1, 2: 0, 3: 0, 4: 1, 5: 2 })
})

test('empty and out-of-range ratings do not break the average', () => {
  assert.deepEqual(summarizeReviews([]), { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } })
  assert.equal(summarizeReviews([0, 6, 5]).count, 1)
})
