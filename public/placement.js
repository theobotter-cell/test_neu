// Reads the Bitrix24 placement context from the URL — never from a form field.
// Per Vibecode's app-runtime contract, BX24.placement.info() does not see this
// context when the app is opened through the platform handler, so the URL is
// the only source: ?placement=CRM_DEAL_DETAIL_TAB&placement_options={"ID":"42"}

const DEAL_ID_PATTERN = /^[1-9][0-9]*$/

export function readPlacementContext() {
  const params = new URLSearchParams(window.location.search)
  const placement = params.get('placement')
  const rawOptions = params.get('placement_options')

  let dealId = null
  if (rawOptions) {
    try {
      const options = JSON.parse(rawOptions)
      const id = String(options.ID ?? '')
      if (DEAL_ID_PATTERN.test(id)) dealId = id
    } catch {
      dealId = null
    }
  }

  return { placement, dealId }
}
