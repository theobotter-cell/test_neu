// Minimal Vibecode V1 client for a vibe_api_ key. Retries only transient failures.
const BASE = (process.env.VIBE_API_BASE || 'https://vibecode.bitrix24.com/v1').replace(/\/$/, '')
const RETRYABLE = new Set([429, 502, 503, 504])
const MAX_RETRIES = 3

export class VibeApiError extends Error {
  constructor(code, message, status) {
    super(message)
    this.name = 'VibeApiError'
    this.code = code
    this.status = status
  }
}

export async function call(method, path, body) {
  const key = process.env.VIBE_API_KEY
  if (!key) throw new VibeApiError('NO_KEY', 'VIBE_API_KEY is not set', 0)
  for (let attempt = 0; ; attempt++) {
    let res
    try {
      res = await fetch(BASE + path, {
        method,
        signal: AbortSignal.timeout(20_000),
        headers: { 'X-Api-Key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch (err) {
      if (attempt < MAX_RETRIES) { await sleep(500 * 2 ** attempt); continue }
      throw new VibeApiError('NETWORK_ERROR', String(err?.message || err), 0)
    }
    if (res.status === 204) return { data: null } // e.g. DELETE of a product row
    const json = await res.json().catch(() => null)
    if (res.ok && json?.success) return { data: json.data, meta: json.meta }
    if (RETRYABLE.has(res.status) && attempt < MAX_RETRIES) {
      const ra = Number(res.headers.get('Retry-After'))
      await sleep(ra > 0 ? ra * 1000 : 500 * 2 ** attempt)
      continue
    }
    throw new VibeApiError(json?.error?.code || `HTTP_${res.status}`, json?.error?.message || `HTTP ${res.status}`, res.status)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Invoices = Smart Invoice, CRM entity type 31. This app only ever touches these endpoints.
export const invoices = {
  search: (body) => call('POST', '/invoices/search', body),
  products: async (id) => {
    const rows = []
    for (let offset = 0; ; ) {
      const { data, meta } = await call('GET', `/invoices/${id}/products?limit=5000&offset=${offset}`)
      rows.push(...data)
      if (!meta?.hasMore || data.length === 0) return rows
      offset += data.length
    }
  },
  addProduct: (id, row) => call('POST', `/invoices/${id}/products`, row).then((r) => r.data),
  updateProduct: (id, rowId, row) => call('PATCH', `/invoices/${id}/products/${rowId}`, row).then((r) => r.data),
  deleteProduct: (id, rowId) => call('DELETE', `/invoices/${id}/products/${rowId}`),
}
