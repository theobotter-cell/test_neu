import { VibeApiError } from './vibeClient'

export interface FriendlyError {
  httpStatus: number
  code: string
  message: string
  retryable: boolean
  retryAfterSeconds?: number
}

const NOT_FOUND_CODES = new Set(['ENTITY_NOT_FOUND', 'DEAL_NOT_FOUND'])
const ACCESS_DENIED_CODES = new Set(['ACCESS_DENIED'])
const SCOPE_DENIED_CODES = new Set(['SCOPE_DENIED', 'INSUFFICIENT_SCOPE'])
const SESSION_CODES = new Set(['TOKEN_MISSING', 'SESSION_EXPIRED', 'INVALID_API_KEY'])
const RATE_LIMIT_CODES = new Set(['RATE_LIMITED'])
const UNSUPPORTED_CODES = new Set(['INVALID_ENTITY_TYPE', 'INVALID_FILTER_FIELD'])

/**
 * Translates a Vibecode/Bitrix24 error into a message safe to show inside the
 * Bitrix24 iframe — no stack traces, no raw upstream payloads. Keys off the real
 * HTTP status first (so an unmapped code still gets a sane status), then refines
 * the message using the documented error code where we recognize it.
 */
export function toFriendlyError(err: unknown): FriendlyError {
  if (!(err instanceof VibeApiError)) {
    return {
      httpStatus: 500,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Please try again.',
      retryable: true,
    }
  }

  if (NOT_FOUND_CODES.has(err.code) || err.httpStatus === 404) {
    return {
      httpStatus: 404,
      code: 'DEAL_NOT_FOUND',
      message: 'The Deal could not be found or is no longer available.',
      retryable: false,
    }
  }

  if (SESSION_CODES.has(err.code) || err.httpStatus === 401) {
    return {
      httpStatus: 401,
      code: 'SESSION_EXPIRED',
      message: 'Your session has expired. Please reopen this tab from the Deal card.',
      retryable: false,
    }
  }

  if (SCOPE_DENIED_CODES.has(err.code)) {
    return {
      httpStatus: 403,
      code: 'SCOPE_DENIED',
      message: 'This app is missing a required Bitrix24 permission (CRM). Ask an administrator to reinstall it.',
      retryable: false,
    }
  }

  if (ACCESS_DENIED_CODES.has(err.code) || err.httpStatus === 403) {
    return {
      httpStatus: 403,
      code: 'ACCESS_DENIED',
      message: 'You do not have permission to view this Deal or its change history.',
      retryable: false,
    }
  }

  if (UNSUPPORTED_CODES.has(err.code)) {
    return {
      httpStatus: 501,
      code: 'HISTORY_UNSUPPORTED',
      message: 'Deal change history is not available through the API for this portal.',
      retryable: false,
    }
  }

  if (RATE_LIMIT_CODES.has(err.code) || err.httpStatus === 429) {
    return {
      httpStatus: 429,
      code: 'RATE_LIMITED',
      message: 'Bitrix24 is rate-limiting requests right now. Please try again shortly.',
      retryable: true,
      retryAfterSeconds: err.retryAfterSeconds ?? 5,
    }
  }

  if (err.httpStatus >= 500) {
    return {
      httpStatus: 503,
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'Bitrix24/Vibecode is temporarily unavailable. Please try again.',
      retryable: true,
      retryAfterSeconds: err.retryAfterSeconds ?? 5,
    }
  }

  return {
    httpStatus: 502,
    code: err.code,
    message: 'The change history could not be loaded right now.',
    retryable: true,
  }
}
