import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateDealId, normalizePageParams, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../src/dealHistory'

test('validateDealId accepts a bare positive integer', () => {
  assert.equal(validateDealId('368'), 368)
  assert.equal(validateDealId('1'), 1)
})

test('validateDealId rejects malformed input rather than trusting the placement URL blindly', () => {
  assert.equal(validateDealId(undefined), null)
  assert.equal(validateDealId(''), null)
  assert.equal(validateDealId('0'), null)
  assert.equal(validateDealId('-5'), null)
  assert.equal(validateDealId('12.5'), null)
  assert.equal(validateDealId('12abc'), null)
  assert.equal(validateDealId('  12'), null)
})

test('normalizePageParams defaults to ascending order, offset 0, default page size', () => {
  const params = normalizePageParams(undefined, undefined, undefined)
  assert.deepEqual(params, { order: 'asc', offset: 0, limit: DEFAULT_PAGE_SIZE })
})

test('normalizePageParams accepts an explicit desc order and offset', () => {
  const params = normalizePageParams('desc', '50', '20')
  assert.deepEqual(params, { order: 'desc', offset: 50, limit: 20 })
})

test('normalizePageParams treats anything other than "desc" as ascending', () => {
  assert.equal(normalizePageParams('DESC', 0, 10).order, 'asc')
  assert.equal(normalizePageParams('garbage', 0, 10).order, 'asc')
})

test('normalizePageParams clamps an oversized limit instead of allowing an unbounded fetch', () => {
  const params = normalizePageParams('asc', 0, 999999)
  assert.equal(params.limit, MAX_PAGE_SIZE)
})

test('normalizePageParams falls back to defaults for a negative or non-numeric offset/limit', () => {
  assert.equal(normalizePageParams('asc', -5, 10).offset, 0)
  assert.equal(normalizePageParams('asc', 'nope', 10).offset, 0)
  assert.equal(normalizePageParams('asc', 0, 'nope').limit, DEFAULT_PAGE_SIZE)
  assert.equal(normalizePageParams('asc', 0, 0).limit, DEFAULT_PAGE_SIZE)
})
