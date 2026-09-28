// Pure discount logic — no I/O, fully unit-tested.
import { createHash } from 'node:crypto'

export const VAT_RATE = 19
const OWN_NAME_RE = /^Rabatt \d+(?:[.,]\d+)? %$/

/** Tier rule: strictly "greater than", not cumulative, applies to the full net total. */
export function discountRateFor(netCents) {
  if (netCents > 200_000) return 5
  if (netCents > 100_000) return 3
  return 0
}

export function discountName(rate) {
  return `Rabatt ${rate} %`
}

/** A row is ours if its id is the stored mapping, or (fallback) its name matches "Rabatt X %". */
export function isOwnRow(row, mappedRowId) {
  if (mappedRowId != null && Number(row.id) === Number(mappedRowId)) return true
  return OWN_NAME_RE.test(String(row.productName ?? '').trim())
}

/**
 * Net amount of one row, excluding VAT, after any row-level discount.
 * Bitrix24 always stores `price` as the gross unit price; `priceExclusive` is the net one.
 */
export function rowNet(row) {
  const qty = Number(row.quantity ?? 0)
  let unitNet = Number(row.priceExclusive)
  if (!Number.isFinite(unitNet)) {
    const price = Number(row.price ?? 0)
    const tax = Number(row.taxRate ?? 0)
    unitNet = tax > 0 ? price / (1 + tax / 100) : price
  }
  return unitNet * qty
}

export function toCents(amount) {
  return Math.round(amount * 100)
}

/** Stable fingerprint of all non-discount rows — used to log "no product change". */
export function hashRows(rows) {
  const norm = rows
    .map((r) => [r.id, r.productId, r.productName, r.price, r.quantity, r.taxRate, !!r.taxIncluded, r.discount ?? 0])
    .sort((a, b) => Number(a[0]) - Number(b[0]))
  return createHash('sha1').update(JSON.stringify(norm)).digest('hex').slice(0, 16)
}

/**
 * Compute the target state and the minimal list of actions for one invoice.
 * Returns { netCents, rate, discountCents, hash, actions: [...] } — empty actions means
 * the invoice is already in the target state and nothing must be written.
 */
export function plan(rows, mappedRowId) {
  const own = rows.filter((r) => isOwnRow(r, mappedRowId))
  const others = rows.filter((r) => !isOwnRow(r, mappedRowId))

  const netCents = toCents(others.reduce((sum, r) => sum + rowNet(r), 0))
  const rate = discountRateFor(netCents)
  const discountCents = rate ? Math.round((netCents * rate) / 100) : 0
  const hash = hashRows(others)
  const actions = []

  if (!rate) {
    for (const r of own) actions.push({ type: 'delete', rowId: r.id, reason: 'net total <= 1000.00' })
    return { netCents, rate, discountCents, hash, actions }
  }

  const target = targetRow(rate, discountCents)
  // Prefer the mapped row, else the first matching one; every extra own row is a duplicate.
  const keep = own.find((r) => mappedRowId != null && Number(r.id) === Number(mappedRowId)) ?? own[0]
  for (const r of own) {
    if (r !== keep) actions.push({ type: 'delete', rowId: r.id, reason: 'duplicate discount row' })
  }

  if (!keep) {
    actions.push({ type: 'add', row: target })
  } else if (matchesTarget(keep, target, discountCents)) {
    // already correct — nothing to write
  } else if (String(keep.productName).trim() === target.productName) {
    const { productName, sort, ...fields } = target
    actions.push({ type: 'update', rowId: keep.id, row: fields })
  } else {
    // Name changes (3 % <-> 5 %) cannot be PATCHed — replace: remove the old row, then add the new one,
    // so the invoice never carries two discount rows at once.
    actions.push({ type: 'delete', rowId: keep.id, reason: `replaced by ${target.productName}` })
    actions.push({ type: 'add', row: target })
  }
  return { netCents, rate, discountCents, hash, actions }
}

/**
 * Gross unit price (after the row's own discount) that yields exactly -discount as net
 * (priceExclusive) at 19 % VAT, tax not included.
 */
export function grossPriceFor(discountCents) {
  return -Math.round(discountCents * (100 + VAT_RATE)) / 10_000
}

export function targetRow(rate, discountCents) {
  return {
    productName: discountName(rate),
    price: grossPriceFor(discountCents),
    quantity: 1,
    taxRate: VAT_RATE,
    taxIncluded: false,
    // The amount is booked as the row's own discount on a net list price of 0.00, so Bitrix24
    // shows it in "Rabattbetrag" and in the invoice's "Gesamtrabatt" total, while the row
    // total (priceExclusive = 0 - discount) is the negative net amount.
    discountTypeId: 1,
    discount: discountCents / 100,
    sort: 99999,
  }
}

function matchesTarget(row, target, discountCents) {
  return (
    String(row.productName).trim() === target.productName &&
    Number(row.quantity) === 1 &&
    Number(row.taxRate) === VAT_RATE &&
    !isTrue(row.taxIncluded) &&
    Number(row.discountTypeId) === 1 &&
    toCents(Number(row.discount ?? 0)) === discountCents &&
    toCents(rowNet({ ...row, quantity: 1 })) === -discountCents
  )
}

function isTrue(v) {
  return v === true || v === 'Y'
}
