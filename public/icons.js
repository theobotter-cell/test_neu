// Minimal inline icon set (stroke-based, 24x24 viewbox) — no icon font or CDN.
// Icons are decorative only: every use still carries a text label alongside it.

const svg = (paths) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

export const icons = {
  refresh: svg('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>'),
  sort: svg('<path d="M3 6h18M6 12h12M10 18h4"/>'),
  user: svg('<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="5"/>'),
  info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
  stage: svg('<path d="M4 4v16M4 4h13l-3 4 3 4H4"/>'),
  pipeline: svg('<path d="M4 4h16l-6 8v6l-4 2v-8L4 4Z"/>'),
  empty: svg(
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 14h.01M12 14h4"/>',
  ),
}
