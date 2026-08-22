import { icons } from './icons.js'

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

// Dates are formatted in the browser's own locale/timezone (the timezone of
// the employee currently viewing the card), never assumed to be UTC.
export function formatDateTime(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return dateTimeFormatter.format(date)
}

function el(html) {
  const template = document.createElement('template')
  template.innerHTML = html.trim()
  return template.content.firstElementChild
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str ?? ''
  return div.innerHTML
}

function semanticBadge(semantics) {
  if (semantics === 'S') return '<span class="stage-flag won">Won</span>'
  if (semantics === 'F') return '<span class="stage-flag lost">Lost</span>'
  return ''
}

function historyRow(entry) {
  const isPipeline = entry.kind === 'pipeline'
  return `
    <div class="history-row" role="row">
      <div class="cell cell-date" role="cell" data-label="Date &amp; time">${formatDateTime(entry.changedAt)}</div>
      <div class="cell cell-user" role="cell" data-label="Changed by">
        ${icons.user}<span>${entry.changedByName ? escapeHtml(entry.changedByName) : 'User unavailable'}</span>
      </div>
      <div class="cell cell-field" role="cell" data-label="Field">
        <span class="field-badge ${isPipeline ? 'pipeline' : ''}">${isPipeline ? icons.pipeline : icons.stage}${escapeHtml(entry.fieldLabel)}</span>
      </div>
      <div class="cell cell-old" role="cell" data-label="Previous value">${escapeHtml(entry.oldValue.label)}</div>
      <div class="cell cell-new" role="cell" data-label="New value">
        ${escapeHtml(entry.newValue.label)}${isPipeline ? '' : semanticBadge(entry.semantics)}
      </div>
    </div>`
}

export function renderSkeleton(root) {
  const rows = Array.from({ length: 6 })
    .map(
      () => `
      <div class="history-row skeleton-row">
        <div class="skel skel-line" style="width:120px"></div>
        <div class="skel skel-line" style="width:100px"></div>
        <div class="skel skel-line" style="width:60px"></div>
        <div class="skel skel-line" style="width:90px"></div>
        <div class="skel skel-line" style="width:90px"></div>
      </div>`,
    )
    .join('')

  root.innerHTML = `
    <div class="header">
      <div class="header-titles">
        <h1>Change History</h1>
        <p class="skel skel-line" style="width:160px;height:14px;"></p>
      </div>
    </div>
    <div class="history-list">${rows}</div>`
}

export function renderStatePanel(root, { title, message, showRetry, onRetry }) {
  root.innerHTML = ''
  const panel = el(`
    <div class="state-panel error">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      ${showRetry ? '<button type="button" class="retry-btn">Retry</button>' : ''}
    </div>`)
  if (showRetry) {
    panel.querySelector('.retry-btn').addEventListener('click', onRetry)
  }
  root.appendChild(panel)
}

export function renderHistory(root, page, handlers) {
  const { deal, entries, order, loaded, hasMore, totalKnown, warnings } = page
  const { onRefresh, onOrderChange, onLoadMore, refreshing, loadingMore } = handlers

  const countLabel =
    totalKnown !== null ? `${totalKnown} change${totalKnown === 1 ? '' : 's'} available` : `Loaded ${loaded} changes`

  root.innerHTML = `
    <div class="header">
      <div class="header-titles">
        <h1>Change History</h1>
        <p class="deal-title">${escapeHtml(deal.title)}</p>
        <p class="deal-meta">${escapeHtml(deal.currentPipelineLabel)} · ${escapeHtml(deal.currentStageLabel)} — ${escapeHtml(countLabel)}</p>
      </div>
      <div class="header-actions">
        <label class="order-select">
          ${icons.sort}
          <select aria-label="Sort order">
            <option value="asc" ${order === 'asc' ? 'selected' : ''}>Oldest first</option>
            <option value="desc" ${order === 'desc' ? 'selected' : ''}>Newest first</option>
          </select>
        </label>
        <button type="button" class="refresh-btn" aria-label="Refresh change history" ${
          refreshing ? 'aria-busy="true" disabled' : ''
        }>
          ${icons.refresh}
          Refresh
        </button>
      </div>
    </div>

    <div class="notice-banner info">
      ${icons.info}
      <span>This view shows stage and pipeline change history available from Bitrix24. It does not include other field edits or general timeline activities.</span>
    </div>

    ${
      warnings.length > 0
        ? `<div class="notice-banner warning">${icons.info}<span>${escapeHtml(warnings.join(' '))}</span></div>`
        : ''
    }

    ${
      entries.length === 0
        ? `<div class="state-panel empty">
            ${icons.empty}
            <h2>No changes found</h2>
            <p>No field or stage changes are available for this Deal.</p>
          </div>`
        : `<div class="history-list" role="table" aria-label="Deal change history">
            <div class="history-row history-row-head" role="row">
              <div class="cell" role="columnheader">Date &amp; time</div>
              <div class="cell" role="columnheader">Changed by</div>
              <div class="cell" role="columnheader">Field</div>
              <div class="cell" role="columnheader">Previous value</div>
              <div class="cell" role="columnheader">New value</div>
            </div>
            ${entries.map(historyRow).join('')}
          </div>
          ${
            hasMore
              ? `<button type="button" class="load-more-btn" ${loadingMore ? 'aria-busy="true" disabled' : ''}>
                  ${loadingMore ? 'Loading…' : 'Load more'}
                </button>`
              : ''
          }`
    }
  `

  root.querySelector('.refresh-btn').addEventListener('click', onRefresh)
  root.querySelector('.order-select select').addEventListener('change', (e) => onOrderChange(e.target.value))
  const loadMoreBtn = root.querySelector('.load-more-btn')
  if (loadMoreBtn) loadMoreBtn.addEventListener('click', onLoadMore)
}
