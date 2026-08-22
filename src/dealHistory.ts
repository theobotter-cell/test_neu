import { vibeCall, vibeCallEnvelope } from './vibeClient'
import {
  attachMoverToLatest,
  deriveTransitions,
  formatEntry,
  formatPipelineEntry,
  paginate,
  resolvePipelineLabel,
  resolveStageLabel,
  sortAscending,
} from './format'
import { DealHistoryEntry, DealHistoryPage, DealRecord, PipelineRecord, StageHistoryRecord, StageStatusRecord } from './types'

// Verified live against https://vibecode.bitrix24.com/v1/guide and /v1/openapi.json:
// deals only exposes /v1/stage-history (crm.stagehistory.list equivalent) — there is
// no field-value change-history endpoint (no crm.item.history.list equivalent) on
// this platform surface. Every record carries both stageId and categoryId, so a
// "kind: stage" entry is always emitted and a "kind: pipeline" entry alongside it
// whenever the deal's pipeline also changed at that same moment.
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

interface RawCategory {
  id: number
  name: string
}

/**
 * Pipelines are portal-level, not per-deal — GET /v1/deal-categories lists every
 * pipeline on the portal in one call, so this is fetched once per request rather
 * than per categoryId. categoryId 0 (the default pipeline) deliberately never
 * appears in that list — resolvePipelineLabel special-cases it.
 */
async function resolvePipelines(bearer: string): Promise<Map<number, PipelineRecord>> {
  const map = new Map<number, PipelineRecord>()
  try {
    const { data } = await vibeCallEnvelope<RawCategory[]>('/v1/deal-categories', {
      bearer,
      query: { limit: 200 },
    })
    for (const c of data) {
      map.set(c.id, { id: c.id, name: c.name })
    }
  } catch {
    // Left unresolved — resolvePipelineLabel falls back to "Unknown pipeline (...)".
  }
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

export interface DealSearchResult {
  id: number
  title: string
  stageLabel: string
  pipelineLabel: string
}

const SEARCH_RESULT_LIMIT = 10
const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 200

export function normalizeSearchQuery(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().slice(0, MAX_QUERY_LENGTH)
  return trimmed.length >= MIN_QUERY_LENGTH ? trimmed : null
}

/**
 * The only entry point in this app where a Deal ID is not read from trusted
 * placement context — the LEFT_MENU placement has no entity in context at all.
 * Still runs entirely in the searching employee's own Bitrix24 permissions (the
 * same forwarded bearer as every other call here), so results and the deals
 * reachable from them are never broader than what that employee could already
 * see in Bitrix24 itself.
 */
export async function searchDeals(query: string, bearer: string): Promise<DealSearchResult[]> {
  const byTitle = vibeCallEnvelope<RawDeal[]>('/v1/deals/search', {
    method: 'POST',
    bearer,
    body: {
      filter: { title: { $contains: query } },
      select: ['id', 'title', 'stageId', 'categoryId'],
      limit: SEARCH_RESULT_LIMIT,
    },
  })

  const results = new Map<number, RawDeal>()
  for (const d of (await byTitle).data) results.set(d.id, d)

  // A purely-numeric query might be a Deal ID rather than (or in addition to)
  // text in the title — try an exact lookup too, ignoring a miss or denial.
  if (/^[1-9][0-9]*$/.test(query)) {
    try {
      const exact = await vibeCall<RawDeal>(`/v1/deals/${query}`, { bearer })
      results.set(exact.id, exact)
    } catch {
      // Not found, or not visible to this employee — the title matches (if any) still stand.
    }
  }

  const list = [...results.values()].slice(0, SEARCH_RESULT_LIMIT)
  const categoryIds = list.map((d) => d.categoryId ?? 0)
  const [labels, pipelines] = await Promise.all([resolveStageLabels(categoryIds, bearer), resolvePipelines(bearer)])

  return list.map((d) => {
    const categoryId = d.categoryId ?? 0
    return {
      id: d.id,
      title: d.title && d.title.trim() ? d.title : `Deal #${d.id}`,
      stageLabel: resolveStageLabel(labels, categoryId, d.stageId),
      pipelineLabel: resolvePipelineLabel(pipelines, categoryId),
    }
  })
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
  const [labels, pipelines, userNames] = await Promise.all([
    resolveStageLabels(categoryIds, bearer),
    resolvePipelines(bearer),
    resolveUserNames([...moverMap.values()], bearer),
  ])

  const ascendingEntries: DealHistoryEntry[] = []
  for (const t of transitions) {
    ascendingEntries.push(formatEntry(t, labels, moverMap, userNames))
    const pipelineEntry = formatPipelineEntry(t, pipelines, moverMap, userNames)
    if (pipelineEntry) ascendingEntries.push(pipelineEntry)
  }

  const ordered = order === 'asc' ? ascendingEntries : [...ascendingEntries].reverse()
  const { page, hasMore } = paginate(ordered, offset, limit)

  return {
    deal: {
      id: deal.id,
      title: deal.title,
      currentStageLabel: resolveStageLabel(labels, deal.categoryId, deal.stageId),
      currentPipelineLabel: resolvePipelineLabel(pipelines, deal.categoryId),
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
