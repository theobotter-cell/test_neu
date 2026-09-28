// Polling worker: finds invoices (entity type 31) modified since the last poll and reconciles
// their discount row. Writes only when the computed target state differs from the actual one.
import { plan } from './discount.mjs'
import { loadState, saveState } from './state.mjs'
import { invoices } from './vibe.mjs'

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 20_000)
const OVERLAP_MS = 5 * 60_000
const MAX_RETRIES = 5
// Bitrix24 reads date filter values in the account's wall-clock time zone, ignoring offsets.
const PORTAL_TZ = process.env.PORTAL_TIMEZONE || 'Europe/Berlin'

const recent = []
export const status = {
  startedAt: new Date().toISOString(),
  pollIntervalSeconds: POLL_INTERVAL_MS / 1000,
  portalTimezone: PORTAL_TZ,
  polls: 0,
  lastPollAt: null,
  lastPollOk: null,
  lastPollError: null,
  invoicesChecked: 0,
  writes: 0,
  errors: 0,
  recent,
}

export function log(level, msg, extra = {}) {
  const entry = { ts: new Date().toISOString(), level, msg, ...extra }
  console.log(JSON.stringify(entry))
  recent.push(entry)
  if (recent.length > 100) recent.shift()
}

let state
let timer
let stopped = false

export function start() {
  state = loadState()
  status.installedAt = state.installedAt
  log('info', 'worker started', { installedAt: state.installedAt, cursor: state.cursor, pollIntervalSeconds: POLL_INTERVAL_MS / 1000 })
  const tick = async () => {
    try {
      await poll()
    } catch (err) {
      status.lastPollOk = false
      status.lastPollError = `${err.code || 'ERROR'}: ${err.message}`
      status.errors++
      log('error', 'poll failed', { code: err.code, error: err.message })
    } finally {
      if (!stopped) timer = setTimeout(tick, POLL_INTERVAL_MS)
    }
  }
  tick()
}

export function stop() {
  stopped = true
  clearTimeout(timer)
}

async function poll() {
  status.polls++
  status.lastPollAt = new Date().toISOString()
  const pollStartedMs = Date.now()
  const from = new Date(Date.parse(state.cursor) - OVERLAP_MS)
  const { data } = await invoices.search({
    filter: { '>=updatedTime': toPortalLocal(from) },
    sort: 'updatedTime',
    select: ['id', 'updatedTime'],
    limit: 5000,
  })

  const installedMs = Date.parse(state.installedAt)
  const todo = new Map()
  for (const inv of data) {
    const updatedMs = Date.parse(inv.updatedTime)
    if (updatedMs < installedMs) continue // untouched since install: no retroactive processing
    if (state.invoices[inv.id]?.seen === inv.updatedTime) continue // already reconciled at this version
    todo.set(String(inv.id), inv.updatedTime)
  }
  for (const [id, r] of Object.entries(state.retry ?? {})) if (!todo.has(id)) todo.set(id, r.updatedTime)

  for (const [id, updatedTime] of todo) {
    await processInvoice(id, updatedTime)
  }

  const maxSeen = data.reduce((m, i) => Math.max(m, Date.parse(i.updatedTime)), 0)
  state.cursor = new Date(Math.max(maxSeen, pollStartedMs - 2 * 60_000, Date.parse(state.cursor))).toISOString()
  saveState(state)
  status.lastPollOk = true
  status.lastPollError = null
}

async function processInvoice(id, updatedTime) {
  const entry = (state.invoices[id] ??= {})
  status.invoicesChecked++
  try {
    const rows = await invoices.products(id)
    const p = plan(rows, entry.rowId)
    const unchanged = entry.hash === p.hash
    const base = { invoiceId: Number(id), net: p.netCents / 100, rate: p.rate, discount: -p.discountCents / 100 }

    if (p.actions.length === 0) {
      log('info', unchanged ? 'no product change, target state present — nothing written' : 'target state already present — nothing written', base)
    }
    for (const a of p.actions) {
      if (a.type === 'add') {
        const row = await invoices.addProduct(id, a.row)
        entry.rowId = row.id
        log('info', 'discount row added', { ...base, rowId: row.id, name: a.row.productName })
      } else if (a.type === 'update') {
        await invoices.updateProduct(id, a.rowId, a.row)
        entry.rowId = a.rowId
        log('info', 'discount row updated', { ...base, rowId: a.rowId })
      } else if (a.type === 'delete') {
        await invoices.deleteProduct(id, a.rowId)
        if (Number(entry.rowId) === Number(a.rowId)) delete entry.rowId
        log('info', 'discount row removed', { ...base, rowId: a.rowId, reason: a.reason })
      }
      status.writes++
    }
    entry.hash = p.hash
    entry.rate = p.rate
    // Our own writes bump updatedTime; the next poll re-checks once, finds the target state and writes nothing.
    entry.seen = updatedTime
    if (state.retry) delete state.retry[id]
  } catch (err) {
    status.errors++
    if (err.status === 404 || err.code === 'ENTITY_NOT_FOUND') {
      log('warn', 'invoice not found (deleted?) — skipped', { invoiceId: Number(id), code: err.code })
      delete state.invoices[id]
      if (state.retry) delete state.retry[id]
      return
    }
    state.retry ??= {}
    const attempts = (state.retry[id]?.attempts ?? 0) + 1
    if (attempts > MAX_RETRIES) {
      delete state.retry[id]
      entry.seen = updatedTime
      log('error', 'invoice failed repeatedly — giving up until its next change', { invoiceId: Number(id), code: err.code, error: err.message })
    } else {
      state.retry[id] = { updatedTime, attempts }
      log('error', 'invoice processing failed — will retry next poll', { invoiceId: Number(id), attempt: attempts, code: err.code, error: err.message })
    }
  }
}

function toPortalLocal(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: PORTAL_TZ, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date).map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
}
