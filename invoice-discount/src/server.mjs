// Entry point: starts the background worker and a tiny status endpoint (no UI).
import { createServer } from 'node:http'
import { log, start, status } from './worker.mjs'

process.on('unhandledRejection', (err) => log('error', 'unhandled rejection', { error: String(err?.message || err) }))
process.on('uncaughtException', (err) => log('error', 'uncaught exception', { error: String(err?.message || err) }))

const port = Number(process.env.PORT || 3000)
createServer((req, res) => {
  const path = (req.url || '/').split('?')[0]
  if (req.method === 'GET' && (path === '/' || path === '/health' || path === '/status')) {
    const body = path === '/health'
      ? { ok: status.lastPollOk !== false, lastPollAt: status.lastPollAt }
      : { app: 'invoice-tier-discount', ...status }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body, null, 2))
    return
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end('{"error":"not found"}')
}).listen(port, () => log('info', 'status endpoint listening', { port }))

start()
