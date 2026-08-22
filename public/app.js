import { readPlacementContext } from './placement.js'
import { fetchDealHistory, searchDeals, ApiError } from './api.js'
import { renderSkeleton, renderStatePanel, renderHistory, renderSearchShell, renderSearchResults } from './render.js'

const root = document.getElementById('app')
const PAGE_SIZE = 50
const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

// Accumulated entries for the current (dealId, order) session — reset on
// refresh or order change, appended to on "Load more".
let state = null

// Only set while the search shell (LEFT_MENU entry point, no Deal in
// placement context) is on screen — holds the results container + debounce
// timer so keystrokes only ever touch that container, never the input itself.
let search = null

async function main() {
  const { dealId } = readPlacementContext()

  if (!dealId) {
    startSearch()
    return
  }

  await loadFirstPage(dealId, 'asc', { viaSearch: false })
}

function startSearch() {
  search = { resultsContainer: null, debounceTimer: null }
  search.resultsContainer = renderSearchShell(root, {
    onInput: handleSearchInput,
    onSelect: (dealId) => loadFirstPage(dealId, 'asc', { viaSearch: true }),
  })
}

function handleSearchInput(rawValue) {
  if (!search) return
  clearTimeout(search.debounceTimer)
  const query = rawValue.trim()

  if (query.length < MIN_QUERY_LENGTH) {
    renderSearchResults(search.resultsContainer, { query: '', results: [], loading: false })
    return
  }

  search.debounceTimer = setTimeout(async () => {
    renderSearchResults(search.resultsContainer, { query, results: [], loading: true })
    try {
      const results = await searchDeals(query)
      // Ignore a stale response if the shell was replaced by a selected Deal's history meanwhile.
      if (search) renderSearchResults(search.resultsContainer, { query, results, loading: false })
    } catch (err) {
      if (!search) return
      const message = err instanceof ApiError ? err.message : 'Search failed. Please try again.'
      renderSearchResults(search.resultsContainer, { query, results: [], loading: false, error: message })
    }
  }, SEARCH_DEBOUNCE_MS)
}

async function loadFirstPage(dealId, order, { refreshing = false, viaSearch = state?.viaSearch ?? false } = {}) {
  search = null // leaving the search shell, if it was showing
  if (!refreshing) renderSkeleton(root)

  try {
    const page = await fetchDealHistory(dealId, { order, offset: 0, limit: PAGE_SIZE })
    state = { dealId, order, entries: page.entries, page, viaSearch }
    renderHistory(root, page, buildHandlers())
  } catch (err) {
    renderError(err, () => loadFirstPage(dealId, order, { viaSearch }))
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
    renderError(err, () => loadFirstPage(state.dealId, state.order, { viaSearch: state.viaSearch }))
  }
}

function onOrderChange(order) {
  if (!state) return
  loadFirstPage(state.dealId, order, { viaSearch: state.viaSearch })
}

function onRefresh() {
  if (!state) return
  loadFirstPage(state.dealId, state.order, { refreshing: true, viaSearch: state.viaSearch })
}

function buildHandlers() {
  return {
    onRefresh,
    onOrderChange,
    onLoadMore: loadMore,
    onBackToSearch: state?.viaSearch ? startSearch : undefined,
    refreshing: false,
    loadingMore: false,
  }
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
