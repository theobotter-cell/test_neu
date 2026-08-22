import { icons } from './icons.js'

const dateFormatter = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

// Dates are formatted in the browser's own locale/timezone (the timezone of
// the employee currently viewing the card), never assumed to be UTC.
export function formatDate(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}

export function formatRelative(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diffMs = date.getTime() - Date.now()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (Math.abs(diffDays) < 1) return 'today'
  if (Math.abs(diffDays) < 30) return relativeFormatter.format(diffDays, 'day')
  const diffMonths = Math.round(diffDays / 30)
  if (Math.abs(diffMonths) < 12) return relativeFormatter.format(diffMonths, 'month')
  const diffYears = Math.round(diffDays / 365)
  return relativeFormatter.format(diffYears, 'year')
}

function el(html) {
  const template = document.createElement('template')
  template.innerHTML = html.trim()
  return template.content.firstElementChild
}

function kpiCard({ icon, label, value, sub, unavailable }) {
  const valueHtml = unavailable
    ? `<div class="kpi-value unavailable">Unavailable</div>`
    : `<div class="kpi-value">${value}</div>`
  return `
    <div class="kpi-card">
      <div class="kpi-card-head">${icons[icon]}<span>${label}</span></div>
      ${valueHtml}
      ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
    </div>`
}

export function renderSkeleton(root) {
  const cards = Array.from({ length: 6 })
    .map(
      () => `
      <div class="kpi-card">
        <div class="skel skel-label" style="width:50%;margin-bottom:10px;"></div>
        <div class="skel skel-value"></div>
      </div>`,
    )
    .join('')

  root.innerHTML = `
    <div class="header">
      <div class="header-titles">
        <h1>Contact Insights</h1>
        <p class="skel skel-label" style="width:140px;height:15px;"></p>
      </div>
    </div>
    <div class="kpi-grid">${cards}</div>`
}

export function renderStatePanel(root, { title, message, showRetry, onRetry }) {
  root.innerHTML = ''
  const panel = el(`
    <div class="state-panel error">
      <h2>${title}</h2>
      <p>${message}</p>
      ${showRetry ? '<button type="button" class="retry-btn">Retry</button>' : ''}
    </div>`)
  if (showRetry) {
    panel.querySelector('.retry-btn').addEventListener('click', onRetry)
  }
  root.appendChild(panel)
}

export function renderStats(root, data, { onRefresh, refreshing }) {
  const { contact, statistics, unavailable = [] } = data
  const isUnavailable = (key) => unavailable.includes(key)

  root.innerHTML = `
    <div class="header">
      <div class="header-titles">
        <h1>Contact Insights</h1>
        <p class="contact-name">${escapeHtml(contact.name)}</p>
        <p class="contact-id">Contact #${contact.id}</p>
      </div>
      <button type="button" class="refresh-btn" aria-label="Refresh statistics" ${refreshing ? 'aria-busy="true" disabled' : ''}>
        <svg class="kpi-icon refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
        Refresh
      </button>
    </div>
    ${
      unavailable.length > 0
        ? `<div class="notice-banner">Some statistics could not be loaded right now (${unavailable.join(', ')}). The rest are shown below.</div>`
        : ''
    }
    <div class="kpi-grid">
      ${kpiCard({
        icon: 'calendar',
        label: 'Created',
        value: formatDate(contact.createdAt),
        sub: formatRelative(contact.createdAt),
      })}
      ${kpiCard({
        icon: 'eye',
        label: 'Insights views',
        value: statistics.views,
        sub: `Tracked since ${formatDate(statistics.trackingSince)}`,
      })}
      ${kpiCard({
        icon: 'inbox',
        label: 'Incoming emails',
        value: statistics.incomingEmails,
        unavailable: isUnavailable('incomingEmails'),
      })}
      ${kpiCard({
        icon: 'send',
        label: 'Outgoing emails',
        value: statistics.outgoingEmails,
        unavailable: isUnavailable('outgoingEmails'),
      })}
      ${kpiCard({
        icon: 'mail',
        label: 'Total emails',
        value: statistics.totalEmails,
        unavailable: statistics.totalEmails === null,
      })}
      ${kpiCard({
        icon: 'message',
        label: 'Timeline comments',
        value: statistics.timelineComments,
        unavailable: isUnavailable('timelineComments'),
      })}
    </div>`

  root.querySelector('.refresh-btn').addEventListener('click', onRefresh)
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str ?? ''
  return div.innerHTML
}
