import { Request, Response, NextFunction } from 'express'
import { vibeCall } from './vibeClient'
import { VibeMeIdentity } from './types'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // matches vibe_session_* token lifetime

interface CacheEntry {
  identity: VibeMeIdentity
  expiresAt: number
}

const identityCache = new Map<string, CacheEntry>()

function extractBearer(req: Request): string | null {
  const header = req.headers['x-vibe-authorization']
  const raw = Array.isArray(header) ? header[0] : header
  if (!raw) return null
  const match = /^Bearer\s+(.+)$/i.exec(raw)
  return match ? match[1] : null
}

export interface AuthedRequest extends Request {
  bearer?: string
  identity?: VibeMeIdentity
}

/**
 * Resolves the Gateway-injected identity (per-user Backend-for-Frontend pattern).
 * Never trusts anything from the browser other than the placement URL params.
 */
export async function identityMiddleware(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const bearer = extractBearer(req)
  if (!bearer) {
    // No session yet (first paint before the Gateway attaches the cookie, or a
    // request made outside the placement). Routes that need identity handle this.
    next()
    return
  }

  const cached = identityCache.get(bearer)
  if (cached && cached.expiresAt > Date.now()) {
    req.bearer = bearer
    req.identity = cached.identity
    next()
    return
  }

  try {
    const identity = await vibeCall<VibeMeIdentity>('/v1/me', { bearer })
    identityCache.set(bearer, { identity, expiresAt: Date.now() + CACHE_TTL_MS })
    req.bearer = bearer
    req.identity = identity
  } catch {
    // Let the route decide how to respond (401 vs partial data) — identity
    // resolution failing here should never crash the request.
  }
  next()
}
