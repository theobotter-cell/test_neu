// All calls are same-origin, relative to our own backend — the browser never
// talks to Vibecode/Bitrix24 directly and never sees any credential.

export class ApiError extends Error {
  constructor(status, code, message, retryable) {
    super(message)
    this.status = status
    this.code = code
    this.retryable = retryable
  }
}

async function parseErrorBody(res) {
  try {
    const body = await res.json()
    return body?.error ?? {}
  } catch {
    return {}
  }
}

export async function fetchDealHistory(dealId, { order, offset = 0, limit = 50 } = {}) {
  const qs = new URLSearchParams({ order, offset: String(offset), limit: String(limit) })
  const res = await fetch(`/api/deal-history/${encodeURIComponent(dealId)}?${qs}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const err = await parseErrorBody(res)
    throw new ApiError(
      res.status,
      err.code || 'UNKNOWN',
      err.message || 'Failed to load change history.',
      Boolean(err.retryable),
    )
  }
  return res.json()
}
