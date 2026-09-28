// Integration test of the poll loop against a mock Vibecode API (AC10: an API error on one
// invoice is logged with its ID and the next invoices are still processed).
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

test('an API error on one invoice is logged with its ID and processing continues', async () => {
  const later = new Date(Date.now() + 60_000).toISOString()
  const calls = []
  const rows = { 102: [{ id: 1, productName: 'Beratung', price: 1785, priceExclusive: 1500, quantity: 1, taxRate: 19, taxIncluded: false }] }

  const mock = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      calls.push(`${req.method} ${req.url}`)
      const send = (status, json) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(json)) }
      if (req.url === '/v1/invoices/search') return send(200, { success: true, data: [{ id: 101, updatedTime: later }, { id: 102, updatedTime: later }] })
      if (req.url.startsWith('/v1/invoices/101/products')) return send(400, { success: false, error: { code: 'BITRIX_ERROR', message: 'boom' } })
      if (req.method === 'GET' && req.url.startsWith('/v1/invoices/102/products')) return send(200, { success: true, data: rows[102], meta: { hasMore: false } })
      if (req.method === 'POST' && req.url === '/v1/invoices/102/products') {
        const row = { id: 2, ...JSON.parse(body), priceExclusive: -45 }
        rows[102].push(row)
        return send(200, { success: true, data: row })
      }
      send(404, { success: false, error: { code: 'NOT_MOCKED', message: req.url } })
    })
  })
  await new Promise((r) => mock.listen(0, r))

  process.env.VIBE_API_BASE = `http://127.0.0.1:${mock.address().port}/v1`
  process.env.VIBE_API_KEY = 'vibe_api_test'
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'discount-'))
  process.env.POLL_INTERVAL_MS = '100000'

  const lines = []
  const orig = console.log
  console.log = (l) => lines.push(JSON.parse(l))
  const worker = await import('../src/worker.mjs')
  try {
    worker.start()
    await new Promise((r) => setTimeout(r, 500))
  } finally {
    worker.stop()
    console.log = orig
    mock.close()
  }

  const err = lines.find((l) => l.level === 'error' && l.invoiceId === 101)
  assert.ok(err, 'error for invoice 101 is logged with its ID')
  assert.equal(err.code, 'BITRIX_ERROR')
  assert.ok(lines.find((l) => l.msg === 'discount row added' && l.invoiceId === 102), 'invoice 102 still processed')
  assert.equal(rows[102].filter((r) => r.productName === 'Rabatt 3 %').length, 1)
  assert.equal(worker.status.lastPollOk, true)
})
