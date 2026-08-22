export interface VibeMeIdentity {
  type: string
  portal: string
  scopes: string[]
  currentUser: { bitrixUserId: string; _note?: string } | null
  capabilities?: unknown
  tariff?: unknown
  app?: { title: string; id: string }
}

/** Raw shape of one GET /v1/stage-history record, verified live against a real portal. */
export interface StageHistoryRecord {
  id: number
  typeId: number
  ownerId: number
  createdAt: string
  categoryId: number
  stageSemanticId: string
  stageId: string
}

/** Fields this app reads from GET /v1/deals/:id — not the full deal record. */
export interface DealRecord {
  id: number
  title: string
  categoryId: number
  stageId: string
  movedBy: number | null
  movedTime: string | null
}

/** GET /v1/statuses/search row for entityId DEAL_STAGE(_categoryId). */
export interface StageStatusRecord {
  statusId: string
  name: string
  color: string | null
  semantics: string | null
}

/** GET /v1/deal-categories row — a pipeline. categoryId 0 (the built-in default
 *  pipeline) never appears here; it is synthesized as "Default pipeline". */
export interface PipelineRecord {
  id: number
  name: string
}

export interface DealHistoryValue {
  /** Raw Bitrix24 stage code, or null when there is no previous stage to show. */
  raw: string | null
  /** Human-readable label — current portal label, or an honest fallback. */
  label: string
}

export interface DealHistoryEntry {
  stableId: string
  changedAt: string
  changedById: number | null
  changedByName: string | null
  fieldId: 'stageId' | 'categoryId'
  fieldLabel: string
  oldValue: DealHistoryValue
  newValue: DealHistoryValue
  kind: 'stage' | 'pipeline'
  /** Bitrix24 stage semantics for this entry's new stage: P (in progress), S (won), F (lost/other terminal).
   *  Always "P" on a "pipeline" entry — categoryId itself carries no semantics of its own. */
  semantics: string
}

export interface DealHistoryPage {
  deal: {
    id: number
    title: string
    currentStageLabel: string
    currentPipelineLabel: string
  }
  entries: DealHistoryEntry[]
  order: 'asc' | 'desc'
  loaded: number
  hasMore: boolean
  nextOffset: number | null
  /** Exact count when the full history was fetched without hitting the platform cap; null once truncated. */
  totalKnown: number | null
  warnings: string[]
}
