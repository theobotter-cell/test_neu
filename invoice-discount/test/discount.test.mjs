import assert from 'node:assert/strict'
import { test } from 'node:test'
import { discountRateFor, grossPriceFor, plan } from '../src/discount.mjs'

// Rows as Bitrix24 returns them: price is gross, priceExclusive is net.
const item = (id, net, qty = 1, extra = {}) => ({
  id, productId: 0, productName: `Item ${id}`, price: +(net * 1.19).toFixed(4), priceExclusive: net,
  quantity: qty, taxRate: 19, taxIncluded: false, discount: 0, ...extra,
})
const discountRow = (id, rate, net) => ({
  id, productId: 0, productName: `Rabatt ${rate} %`, price: grossPriceFor(Math.round(net * 100)), priceExclusive: -net,
  quantity: 1, taxRate: 19, taxIncluded: false, discount: 0,
})

test('tiers are strictly greater-than and not cumulative', () => {
  assert.equal(discountRateFor(80_000), 0)
  assert.equal(discountRateFor(100_000), 0)
  assert.equal(discountRateFor(100_001), 3)
  assert.equal(discountRateFor(200_000), 3)
  assert.equal(discountRateFor(200_001), 5)
})

test('AC1: 1500 net -> one "Rabatt 3 %" row, -45.00 net, 19 % VAT', () => {
  const p = plan([item(1, 1000), item(2, 250, 2)])
  assert.equal(p.netCents, 150_000)
  assert.deepEqual(p.actions.map((a) => a.type), ['add'])
  const row = p.actions[0].row
  assert.equal(row.productName, 'Rabatt 3 %')
  assert.equal(row.quantity, 1)
  assert.equal(row.taxRate, 19)
  assert.equal(row.taxIncluded, false)
  assert.equal(row.price, -53.55) // gross; Bitrix derives priceExclusive = -45.00
})

test('AC2: 2500 net -> "Rabatt 5 %", -125.00 net', () => {
  const p = plan([item(1, 2500)])
  assert.equal(p.actions[0].row.productName, 'Rabatt 5 %')
  assert.equal(p.actions[0].row.price, -148.75)
})

test('AC3: 800 and exactly 1000 -> no discount row', () => {
  assert.deepEqual(plan([item(1, 800)]).actions, [])
  assert.deepEqual(plan([item(1, 1000)]).actions, [])
})

test('AC4: 1500 -> 2500 replaces the 3 % row with a 5 % row (delete then add, never two rows)', () => {
  const p = plan([item(1, 2500), discountRow(9, 3, 45)], 9)
  assert.deepEqual(p.actions.map((a) => a.type), ['delete', 'add'])
  assert.equal(p.actions[0].rowId, 9)
  assert.equal(p.actions[1].row.productName, 'Rabatt 5 %')
})

test('AC5: 1500 -> 800 removes the discount row', () => {
  const p = plan([item(1, 800), discountRow(9, 3, 45)], 9)
  assert.deepEqual(p.actions, [{ type: 'delete', rowId: 9, reason: 'net total <= 1000.00' }])
})

test('AC6: target state already present -> no writes; discount row is excluded from the base', () => {
  const p = plan([item(1, 1500), discountRow(9, 3, 45)], 9)
  assert.equal(p.netCents, 150_000)
  assert.deepEqual(p.actions, [])
})

test('same tier, new amount -> PATCH in place', () => {
  const p = plan([item(1, 1600), discountRow(9, 3, 45)], 9)
  assert.deepEqual(p.actions.map((a) => a.type), ['update'])
  assert.equal(p.actions[0].row.price, grossPriceFor(4800))
})

test('name-pattern fallback identifies own row without mapping; duplicates are removed', () => {
  const p = plan([item(1, 1500), discountRow(8, 3, 45), discountRow(9, 3, 45)])
  assert.deepEqual(p.actions.map((a) => [a.type, a.rowId]), [['delete', 9]])
})

test('row-level discounts and tax-included rows count by their net value', () => {
  // priceExclusive already reflects row discount and strips included tax
  const p = plan([item(1, 1200, 1, { taxIncluded: true, price: 1428 })])
  assert.equal(p.netCents, 120_000)
  assert.equal(p.rate, 3)
})

test('odd cents: rounding to 2 decimals and gross price maps back exactly', () => {
  const p = plan([item(1, 1234.57)])
  assert.equal(p.discountCents, 3704) // 37.0371 -> 37.04
  assert.equal(Math.round((p.actions[0].row.price / 1.19) * 100), -3704)
})
