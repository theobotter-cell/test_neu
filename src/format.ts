import { DealHistoryEntry, PipelineRecord, StageHistoryRecord, StageStatusRecord } from './types'

/**
 * GET /v1/stage-history has no documented sort parameter (verified against the
 * live guide + OpenAPI schema) and no "previous stage" field on each record —
 * each row marks entry INTO a stage, not a from/to transition. Sorting
 * ascending here is what lets us derive "previous stage" as the stage the
 * immediately-earlier record entered, and re-derive newest-first by reversal
 * instead of trusting server order.
 */
export function sortAscending(records: StageHistoryRecord[]): StageHistoryRecord[] {
  return [...records].sort((a, b) => {
    const ta = Date.parse(a.createdAt)
    const tb = Date.parse(b.createdAt)
    if (ta !== tb) return ta - tb
    return a.id - b.id
  })
}

export interface StageTransition {
  record: StageHistoryRecord
  /** The stage the deal was in immediately before this record, or null for the first-ever record. */
  previous: { categoryId: number; stageId: string } | null
}

/** Must be called with an already chronologically-sorted (ascending) array. */
export function deriveTransitions(sorted: StageHistoryRecord[]): StageTransition[] {
  return sorted.map((record, i) => ({
    record,
    previous: i > 0 ? { categoryId: sorted[i - 1].categoryId, stageId: sorted[i - 1].stageId } : null,
  }))
}

const MOVER_MATCH_TOLERANCE_MS = 1000

/**
 * crm's stage-history rows carry no actor. The deal record's own movedBy/movedTime
 * describe only the single most recent move, so that is the only entry we can ever
 * honestly attribute — matched by timestamp proximity, not assumed by position
 * (a stale movedTime, e.g. after a field-only edit, must not mis-attribute a row).
 */
export function attachMoverToLatest(
  transitions: StageTransition[],
  movedBy: number | null,
  movedTime: string | null,
): Map<number, number> {
  const result = new Map<number, number>()
  if (!movedBy || !movedTime) return result
  const targetMs = Date.parse(movedTime)
  if (Number.isNaN(targetMs)) return result

  let best: StageTransition | null = null
  let bestDiff = Infinity
  for (const t of transitions) {
    const diff = Math.abs(Date.parse(t.record.createdAt) - targetMs)
    if (diff < bestDiff) {
      bestDiff = diff
      best = t
    }
  }
  if (best && bestDiff <= MOVER_MATCH_TOLERANCE_MS) {
    result.set(best.record.id, movedBy)
  }
  return result
}

export function stageLabelKey(categoryId: number, stageId: string): string {
  return `${categoryId}:${stageId}`
}

export function resolveStageLabel(
  labels: ReadonlyMap<string, StageStatusRecord>,
  categoryId: number,
  stageId: string,
): string {
  const found = labels.get(stageLabelKey(categoryId, stageId))
  if (found) return found.name
  return `Unknown stage (${stageId})`
}

const DEFAULT_PIPELINE_CATEGORY_ID = 0

/**
 * categoryId 0 is Bitrix24's built-in default pipeline — verified (GET /v1/guide
 * importantNotes.categoryIdFormat) to never appear as its own GET /v1/deal-categories
 * row, so it is described rather than looked up. Every other id is resolved from
 * that list, falling back honestly for a deleted/inaccessible pipeline.
 */
export function resolvePipelineLabel(pipelines: ReadonlyMap<number, PipelineRecord>, categoryId: number): string {
  if (categoryId === DEFAULT_PIPELINE_CATEGORY_ID) return 'Default pipeline'
  const found = pipelines.get(categoryId)
  if (found) return found.name
  return `Unknown pipeline (${categoryId})`
}

function actorFor(
  record: StageHistoryRecord,
  moverMap: ReadonlyMap<number, number>,
  userNames: ReadonlyMap<number, string>,
): { changedById: number | null; changedByName: string | null } {
  const changedById = moverMap.get(record.id) ?? null
  const changedByName = changedById !== null ? userNames.get(changedById) ?? `User #${changedById}` : null
  return { changedById, changedByName }
}

export function formatEntry(
  transition: StageTransition,
  labels: ReadonlyMap<string, StageStatusRecord>,
  moverMap: ReadonlyMap<number, number>,
  userNames: ReadonlyMap<number, string>,
): DealHistoryEntry {
  const { record, previous } = transition

  const oldValue = previous
    ? { raw: previous.stageId, label: resolveStageLabel(labels, previous.categoryId, previous.stageId) }
    : { raw: null, label: 'Previous stage unavailable' }

  const newValue = { raw: record.stageId, label: resolveStageLabel(labels, record.categoryId, record.stageId) }

  return {
    stableId: `stage-${record.id}`,
    changedAt: record.createdAt,
    ...actorFor(record, moverMap, userNames),
    fieldId: 'stageId',
    fieldLabel: 'Stage',
    oldValue,
    newValue,
    kind: 'stage',
    semantics: record.stageSemanticId,
  }
}

/**
 * Each stage-history record snapshots (categoryId, stageId) at one moment, so a
 * pipeline move and a stage move can happen in the very same record — verified
 * live: every record carries categoryId, not just stageId. Returns null when the
 * pipeline is unchanged from the previous record (the common case), or when this
 * is the deal's first-ever record (no previous pipeline to compare against — the
 * deal was simply created in this pipeline, which is not a "change").
 */
export function formatPipelineEntry(
  transition: StageTransition,
  pipelines: ReadonlyMap<number, PipelineRecord>,
  moverMap: ReadonlyMap<number, number>,
  userNames: ReadonlyMap<number, string>,
): DealHistoryEntry | null {
  const { record, previous } = transition
  if (!previous || previous.categoryId === record.categoryId) return null

  return {
    stableId: `pipeline-${record.id}`,
    changedAt: record.createdAt,
    ...actorFor(record, moverMap, userNames),
    fieldId: 'categoryId',
    fieldLabel: 'Pipeline',
    oldValue: { raw: String(previous.categoryId), label: resolvePipelineLabel(pipelines, previous.categoryId) },
    newValue: { raw: String(record.categoryId), label: resolvePipelineLabel(pipelines, record.categoryId) },
    kind: 'pipeline',
    semantics: 'P',
  }
}

export function paginate<T>(items: readonly T[], offset: number, limit: number): { page: T[]; hasMore: boolean } {
  const safeOffset = Math.max(0, offset)
  const page = items.slice(safeOffset, safeOffset + limit)
  return { page, hasMore: safeOffset + page.length < items.length }
}
