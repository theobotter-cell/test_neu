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

export async function fetchContactStats(contactId) {
  const res = await fetch(`/api/contact-stats/${encodeURIComponent(contactId)}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const err = await parseErrorBody(res)
    throw new ApiError(res.status, err.code || 'UNKNOWN', err.message || 'Failed to load statistics.', Boolean(err.retryable))
  }
  return res.json()
}

export function sendViewEvent(contactId, nonce) {
  // Fire-and-forget: a failure here must never block or degrade the stats view.
  return fetch(`/api/contact-stats/${encodeURIComponent(contactId)}/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nonce }),
  }).catch(() => undefined)
}
