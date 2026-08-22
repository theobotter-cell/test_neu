import { readPlacementContext } from './placement.js'
import { fetchDealHistory, ApiError } from './api.js'
import { renderSkeleton, renderStatePanel, renderHistory } from './render.js'

const root = document.getElementById('app')
const PAGE_SIZE = 50

// Accumulated entries for the current (dealId, order) session — reset on
// refresh or order change, appended to on "Load more".
let state = null

async function main() {
  const { dealId } = readPlacementContext()

  if (!dealId) {
    renderStatePanel(root, {
      title: 'No Deal selected',
      message: 'This app must be opened from a Deal card.',
      showRetry: false,
    })
    return
  }

  await loadFirstPage(dealId, 'asc')
}

async function loadFirstPage(dealId, order, { refreshing = false } = {}) {
  if (!refreshing) renderSkeleton(root)

  try {
    const page = await fetchDealHistory(dealId, { order, offset: 0, limit: PAGE_SIZE })
    state = { dealId, order, entries: page.entries, page }
    renderHistory(root, page, buildHandlers())
  } catch (err) {
    renderError(err, () => loadFirstPage(dealId, order))
  }
}

async function loadMore() {
  if (!state || !state.page.hasMore) return
  renderHistory(root, state.page, { ...buildHandlers(), loadingMore: true })

  try {
    const next = await fetchDealHistory(state.dealId, {
      order: state.order,
      offset: state.page.nextOffset,
      limit: PAGE_SIZE,
    })
    const entries = [...state.entries, ...next.entries]
    const page = { ...next, entries, loaded: next.loaded }
    state = { ...state, entries, page }
    renderHistory(root, page, buildHandlers())
  } catch (err) {
    renderError(err, () => loadFirstPage(state.dealId, state.order))
  }
}

function onOrderChange(order) {
  if (!state) return
  loadFirstPage(state.dealId, order)
}

function onRefresh() {
  if (!state) return
  loadFirstPage(state.dealId, state.order, { refreshing: true })
}

function buildHandlers() {
  return { onRefresh, onOrderChange, onLoadMore: loadMore, refreshing: false, loadingMore: false }
}

function renderError(err, onRetry) {
  if (err instanceof ApiError) {
    renderStatePanel(root, {
      title: titleFor(err.code),
      message: err.message,
      showRetry: err.retryable,
      onRetry,
    })
    return
  }
  renderStatePanel(root, {
    title: 'Something went wrong',
    message: 'Could not load the change history. Please try again.',
    showRetry: true,
    onRetry,
  })
}

function titleFor(code) {
  switch (code) {
    case 'DEAL_NOT_FOUND':
      return 'Deal not found'
    case 'ACCESS_DENIED':
    case 'SCOPE_DENIED':
      return 'Access restricted'
    case 'SESSION_EXPIRED':
      return 'Session expired'
    case 'RATE_LIMITED':
      return 'Slow down a moment'
    case 'HISTORY_UNSUPPORTED':
      return 'History unavailable'
    case 'UPSTREAM_UNAVAILABLE':
      return 'Temporarily unavailable'
    default:
      return 'Could not load change history'
  }
}

main()
