export interface VibeMeIdentity {
  type: string
  portal: string
  scopes: string[]
  currentUser: { bitrixUserId: string; _note?: string } | null
  capabilities?: unknown
  tariff?: unknown
  app?: { title: string; id: string }
}

export interface ContactRecord {
  id: number
  name: string | null
  lastName: string | null
  createdTime: string
  updatedTime: string
}

export interface ContactStatsResponse {
  contact: {
    id: number
    name: string
    createdAt: string
  }
  statistics: {
    incomingEmails: number | null
    outgoingEmails: number | null
    totalEmails: number | null
    timelineComments: number | null
    views: number
    viewMetricType: 'insights_views'
    trackingSince: string
  }
  unavailable: string[]
  warnings?: string[]
}

export interface ViewStoreEntry {
  contactId: number
  totalViews: number
  firstTrackedAt: string
  lastViewedAt: string
}

export interface ViewStoreFile {
  trackingSince: string
  contacts: Record<string, ViewStoreEntry>
}
