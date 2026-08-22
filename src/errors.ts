import { VibeApiError } from './vibeClient'

export interface FriendlyError {
  httpStatus: number
  code: string
  message: string
  retryable: boolean
  retryAfterSeconds?: number
}

/**
 * Translates a Vibecode/Bitrix24 error into a message safe to show inside the
 * Bitrix24 iframe — no stack traces, no raw upstream payloads.
 */
export function toFriendlyError(err: unknown): FriendlyError {
  if (err instanceof VibeApiError) {
    switch (err.code) {
      case 'CONTACT_NOT_FOUND':
      case 'HTTP_404':
        return {
          httpStatus: 404,
          code: 'CONTACT_NOT_FOUND',
          message: 'This contact could not be found. It may have been deleted.',
          retryable: false,
        }
      case 'HTTP_403':
      case 'ACCESS_DENIED':
      case 'INSUFFICIENT_SCOPE':
        return {
          httpStatus: 403,
          code: 'ACCESS_DENIED',
          message: "You don't have permission to view this contact in Bitrix24.",
          retryable: false,
        }
      case 'HTTP_401':
      case 'TOKEN_MISSING':
      case 'SESSION_EXPIRED':
        return {
          httpStatus: 401,
          code: 'SESSION_EXPIRED',
          message: 'Your session has expired. Please reopen this tab from the Contact card.',
          retryable: false,
        }
      case 'HTTP_429':
      case 'RATE_LIMITED':
        return {
          httpStatus: 429,
          code: 'RATE_LIMITED',
          message: 'Bitrix24 is rate-limiting requests right now. Please try again shortly.',
          retryable: true,
          retryAfterSeconds: err.retryAfterSeconds ?? 5,
        }
      default:
        if (err.httpStatus >= 500 || err.httpStatus === 503) {
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
          message: 'This statistic could not be loaded right now.',
          retryable: true,
        }
    }
  }

  return {
    httpStatus: 500,
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong on our side. Please try again.',
    retryable: true,
  }
}
