import { readPlacementContext } from './placement.js'
import { fetchContactStats, sendViewEvent, ApiError } from './api.js'
import { renderSkeleton, renderStatePanel, renderStats } from './render.js'

const root = document.getElementById('app')

// Generated once per page load (module scope, not sessionStorage) — every
// refresh-button click reuses the same value, so the view endpoint (called
// only on the very first load) can never fire twice for one tab opening.
const viewNonce = crypto.randomUUID()

async function main() {
  const { contactId } = readPlacementContext()

  if (!contactId) {
    renderStatePanel(root, {
      title: 'No contact selected',
      message: 'Open this app from the Contact Insights tab on a Contact card in Bitrix24.',
      showRetry: false,
    })
    return
  }

  sendViewEvent(contactId, viewNonce)
  await loadStats(contactId)
}

async function loadStats(contactId, { refreshing = false } = {}) {
  if (!refreshing) renderSkeleton(root)

  try {
    const data = await fetchContactStats(contactId)
    renderStats(root, data, {
      refreshing: false,
      onRefresh: () => loadStats(contactId, { refreshing: true }),
    })
  } catch (err) {
    if (err instanceof ApiError) {
      renderStatePanel(root, {
        title: titleFor(err.code),
        message: err.message,
        showRetry: err.retryable,
        onRetry: () => loadStats(contactId),
      })
      return
    }
    renderStatePanel(root, {
      title: 'Something went wrong',
      message: 'Could not load Contact Insights. Please try again.',
      showRetry: true,
      onRetry: () => loadStats(contactId),
    })
  }
}

function titleFor(code) {
  switch (code) {
    case 'CONTACT_NOT_FOUND':
      return 'Contact not found'
    case 'ACCESS_DENIED':
    case 'SCOPE_DENIED':
      return 'Access restricted'
    case 'SESSION_EXPIRED':
      return 'Session expired'
    case 'RATE_LIMITED':
      return 'Slow down a moment'
    case 'UPSTREAM_UNAVAILABLE':
      return 'Temporarily unavailable'
    default:
      return 'Could not load statistics'
  }
}

main()
