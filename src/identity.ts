import { Request } from 'express'

function extractBearer(req: Request): string | null {
  const header = req.headers['x-vibe-authorization']
  const raw = Array.isArray(header) ? header[0] : header
  if (!raw) return null
  const match = /^Bearer\s+(.+)$/i.exec(raw)
  return match ? match[1] : null
}

export interface AuthedRequest extends Request {
  bearer?: string
}

/**
 * Reads the Gateway-injected per-user session token. This is the only identity
 * signal the app needs: every Bitrix24 call is forwarded with this bearer, so
 * data and permissions are always the current viewer's, never the app's own.
 * No call to /v1/me is required here — the underlying entity calls already
 * surface 401/403 for an invalid or under-scoped session.
 */
export function identityMiddleware(req: AuthedRequest, _res: unknown, next: () => void): void {
  const bearer = extractBearer(req)
  if (bearer) req.bearer = bearer
  next()
}
