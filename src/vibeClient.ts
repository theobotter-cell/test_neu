import { config } from './config'

interface VibeEnvelope<T> {
  success: boolean
  data?: T
  meta?: { total?: number; hasMore?: boolean }
  error?: { code: string; message: string; details?: unknown }
}

export class VibeApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'VibeApiError'
  }
}

interface CallOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  bearer?: string | null
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
  timeoutMs?: number
}

const RETRYABLE_STATUS = new Set([429, 502, 503, 504])
const MAX_RETRIES = 2

function buildUrl(path: string, query?: CallOptions['query']): string {
  const url = new URL(path, config.vibeApiBase)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

/**
 * Thin wrapper around the Vibecode V1 API. Never retries 4xx (validation/permission)
 * errors — only the documented transient 429/502/503/504 responses, honoring Retry-After.
 * Returns the full envelope (data + meta) — use this when meta.total is needed.
 */
export async function vibeCallEnvelope<T>(
  path: string,
  options: CallOptions = {},
): Promise<{ data: T; meta?: { total?: number; hasMore?: boolean } }> {
  const { method = 'GET', bearer, query, body, timeoutMs = 10_000 } = options
  const url = buildUrl(path, query)

  let attempt = 0
  for (;;) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let res: Response
    try {
      res = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          'X-Api-Key': config.vibeAppKey,
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch {
      clearTimeout(timer)
      if (attempt < MAX_RETRIES) {
        attempt += 1
        await sleep(backoffMs(attempt))
        continue
      }
      throw new VibeApiError('NETWORK_ERROR', 'Could not reach Vibecode/Bitrix24.', 503)
    }
    clearTimeout(timer)

    const json = (await safeJson(res)) as VibeEnvelope<T>

    if (res.ok && json?.success) {
      return { data: json.data as T, meta: json.meta }
    }

    const code = json?.error?.code ?? `HTTP_${res.status}`
    const message = json?.error?.message ?? `Unexpected response (${res.status})`
    const retryAfterHeader = res.headers.get('Retry-After')
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined

    if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
      attempt += 1
      await sleep(retryAfterSeconds ? retryAfterSeconds * 1000 : backoffMs(attempt))
      continue
    }

    throw new VibeApiError(code, message, res.status, retryAfterSeconds)
  }
}

export async function vibeCall<T>(path: string, options: CallOptions = {}): Promise<T> {
  const { data } = await vibeCallEnvelope<T>(path, options)
  return data
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function backoffMs(attempt: number): number {
  return 300 * 2 ** attempt
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
