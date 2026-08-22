// Minimal inline icon set (stroke-based, 24x24 viewbox) — no icon font or CDN.
// Icons are decorative only: every KPI card still carries a text label, so the
// statistic is never conveyed by the icon alone.

const svg = (paths) =>
  `<svg class="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

export const icons = {
  calendar: svg(
    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  ),
  eye: svg(
    '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/>',
  ),
  inbox: svg(
    '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/>',
  ),
  send: svg('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'),
  mail: svg(
    '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  ),
  message: svg(
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
  ),
}
