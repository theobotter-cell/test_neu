import { vibeCall, vibeCallEnvelope } from './vibeClient'
import {
  attachMoverToLatest,
  deriveTransitions,
  formatEntry,
  paginate,
  resolveStageLabel,
  sortAscending,
} from './format'
import { DealHistoryPage, DealRecord, StageHistoryRecord, StageStatusRecord } from './types'

// Verified live against https://vibecode.bitrix24.com/v1/guide and /v1/openapi.json:
// deals only exposes /v1/stage-history (crm.stagehistory.list equivalent) — there is
// no field-value change-history endpoint (no crm.item.history.list equivalent) on
// this platform surface, so "kind" is always "stage" here.
const DEAL_ENTITY_TYPE = 'deal'
const STAGE_HISTORY_PAGE_SIZE = 200
const MAX_HISTORY_RECORDS = 2000
export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 200

export function validateDealId(raw: string | undefined): number | null {
  if (!raw || !/^[1-9][0-9]*$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) ? id : null
}

export function normalizePageParams(rawOrder: unknown, rawOffset: unknown, rawLimit: unknown) {
  const order = rawOrder === 'desc' ? 'desc' : 'asc'
  const offset = Number.isInteger(Number(rawOffset)) && Number(rawOffset) >= 0 ? Number(rawOffset) : 0
  const limitCandidate = Number(rawLimit)
  const limit =
    Number.isInteger(limitCandidate) && limitCandidate > 0
      ? Math.min(limitCandidate, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE
  return { order: order as 'asc' | 'desc', offset, limit }
}

interface RawDeal {
  id: number
  title?: string | null
  categoryId?: number | null
  stageId: string
  movedBy?: number | null
  movedTime?: string | null
}

async function fetchDeal(dealId: number, bearer: string): Promise<DealRecord> {
  const raw = await vibeCall<RawDeal>(`/v1/deals/${dealId}`, { bearer })
  return {
    id: raw.id,
    title: raw.title && raw.title.trim() ? raw.title : `Deal #${raw.id}`,
    categoryId: raw.categoryId ?? 0,
    stageId: raw.stageId,
    movedBy: raw.movedBy ?? null,
    movedTime: raw.movedTime ?? null,
  }
}

/**
 * A single deal's own stage history is inherently bounded (deals do not move stage
 * thousands of times), so fetching it in full server-side — capped defensively at
 * MAX_HISTORY_RECORDS — is what lets us sort chronologically, derive "previous
 * stage", and serve either sort order without re-querying Bitrix24. This is a
 * per-deal fetch, never a portal-wide scan.
 */
async function fetchAllStageHistory(
  dealId: number,
  bearer: string,
): Promise<{ records: StageHistoryRecord[]; truncated: boolean }> {
  const records: StageHistoryRecord[] = []
  let offset = 0
  let truncated = false

  for (;;) {
    const { data, meta } = await vibeCallEnvelope<StageHistoryRecord[]>('/v1/stage-history', {
      bearer,
      query: { entityType: DEAL_ENTITY_TYPE, ownerId: dealId, limit: STAGE_HISTORY_PAGE_SIZE, offset },
    })
    records.push(...data)

    if (records.length >= MAX_HISTORY_RECORDS) {
      truncated = Boolean(meta?.hasMore)
      break
    }
    if (!meta?.hasMore || data.length === 0) break
    offset += data.length
  }

  return { records, truncated }
}

interface RawStatus {
  statusId: string
  name: string
  color?: string | null
  semantics?: string | null
}

function stageEntityId(categoryId: number): string {
  return categoryId === 0 ? 'DEAL_STAGE' : `DEAL_STAGE_${categoryId}`
}

/** Resolves current stage labels for every (categoryId, stageId) pair the history touches. */
async function resolveStageLabels(
  categoryIds: readonly number[],
  bearer: string,
): Promise<Map<string, StageStatusRecord>> {
  const map = new Map<string, StageStatusRecord>()
  const uniqueCategories = [...new Set(categoryIds)]

  await Promise.all(
    uniqueCategories.map(async (categoryId) => {
      try {
        const { data } = await vibeCallEnvelope<RawStatus[]>('/v1/statuses/search', {
          method: 'POST',
          bearer,
          body: { filter: { entityId: stageEntityId(categoryId) }, limit: 200 },
        })
        for (const s of data) {
          map.set(`${categoryId}:${s.statusId}`, {
            statusId: s.statusId,
            name: s.name,
            color: s.color ?? null,
            semantics: s.semantics ?? null,
          })
        }
      } catch {
        // Left unresolved for this categoryId — formatEntry/resolveStageLabel fall
        // back to "Unknown stage (...)" per entry rather than failing the request.
      }
    }),
  )

  return map
}

interface RawUser {
  name?: string | null
  lastName?: string | null
}

/** Bounded to the unique user IDs actually referenced (at most one, today: the latest mover). */
async function resolveUserNames(userIds: readonly number[], bearer: string): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  await Promise.all(
    [...new Set(userIds)].map(async (id) => {
      try {
        const user = await vibeCall<RawUser>(`/v1/users/${id}`, { bearer })
        const parts = [user.name, user.lastName].filter(Boolean)
        map.set(id, parts.length > 0 ? parts.join(' ') : `User #${id}`)
      } catch {
        // Left unresolved — formatEntry falls back to `User #${id}`.
      }
    }),
  )
  return map
}

export async function getDealHistoryPage(
  dealId: number,
  bearer: string,
  order: 'asc' | 'desc',
  offset: number,
  limit: number,
): Promise<DealHistoryPage> {
  const warnings: string[] = []

  const deal = await fetchDeal(dealId, bearer)
  const { records, truncated } = await fetchAllStageHistory(dealId, bearer)
  if (truncated) {
    warnings.push(
      `History was truncated at ${MAX_HISTORY_RECORDS} records; the oldest changes for this deal may be missing.`,
    )
  }

  const sorted = sortAscending(records)
  const transitions = deriveTransitions(sorted)
  const moverMap = attachMoverToLatest(transitions, deal.movedBy, deal.movedTime)

  const categoryIds = [...records.map((r) => r.categoryId), deal.categoryId]
  const [labels, userNames] = await Promise.all([
    resolveStageLabels(categoryIds, bearer),
    resolveUserNames([...moverMap.values()], bearer),
  ])

  const ascendingEntries = transitions.map((t) => formatEntry(t, labels, moverMap, userNames))
  const ordered = order === 'asc' ? ascendingEntries : [...ascendingEntries].reverse()
  const { page, hasMore } = paginate(ordered, offset, limit)

  return {
    deal: {
      id: deal.id,
      title: deal.title,
      currentStageLabel: resolveStageLabel(labels, deal.categoryId, deal.stageId),
    },
    entries: page,
    order,
    loaded: Math.min(offset + page.length, ordered.length),
    hasMore,
    nextOffset: hasMore ? offset + page.length : null,
    totalKnown: truncated ? null : ordered.length,
    warnings,
  }
}
