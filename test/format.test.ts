import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sortAscending,
  deriveTransitions,
  attachMoverToLatest,
  resolveStageLabel,
  formatEntry,
  paginate,
} from '../src/format'
import { StageHistoryRecord, StageStatusRecord } from '../src/types'

function record(partial: Partial<StageHistoryRecord> & { id: number }): StageHistoryRecord {
  return {
    id: partial.id,
    typeId: partial.typeId ?? 2,
    ownerId: partial.ownerId ?? 368,
    createdAt: partial.createdAt ?? '2020-01-01T00:00:00Z',
    categoryId: partial.categoryId ?? 0,
    stageSemanticId: partial.stageSemanticId ?? 'P',
    stageId: partial.stageId ?? 'NEW',
  }
}

test('sortAscending orders by createdAt then falls back to id on a tie', () => {
  const records = [
    record({ id: 3, createdAt: '2020-03-01T00:00:00Z' }),
    record({ id: 1, createdAt: '2020-01-01T00:00:00Z' }),
    record({ id: 2, createdAt: '2020-01-01T00:00:00Z' }), // identical timestamp to id:1
  ]
  const sorted = sortAscending(records)
  assert.deepEqual(
    sorted.map((r) => r.id),
    [1, 2, 3],
  )
})

test('sortAscending does not mutate the input array', () => {
  const records = [record({ id: 2, createdAt: '2020-02-01T00:00:00Z' }), record({ id: 1, createdAt: '2020-01-01T00:00:00Z' })]
  const original = [...records]
  sortAscending(records)
  assert.deepEqual(records, original)
})

test('deriveTransitions: the first record has no previous stage', () => {
  const sorted = [record({ id: 1, stageId: 'NEW' }), record({ id: 2, stageId: 'PREPARATION' })]
  const transitions = deriveTransitions(sorted)
  assert.equal(transitions[0].previous, null)
  assert.deepEqual(transitions[1].previous, { categoryId: 0, stageId: 'NEW' })
})

test('deriveTransitions: previous stage is the immediately-earlier record, not the current one', () => {
  const sorted = [
    record({ id: 1, stageId: 'NEW' }),
    record({ id: 2, stageId: 'PREPARATION' }),
    record({ id: 3, stageId: 'WON' }),
  ]
  const transitions = deriveTransitions(sorted)
  assert.equal(transitions[2].previous?.stageId, 'PREPARATION')
})

test('attachMoverToLatest attaches the deal mover only to the record matching movedTime', () => {
  const sorted = [
    record({ id: 1, createdAt: '2020-01-01T00:00:00Z' }),
    record({ id: 2, createdAt: '2020-02-01T00:00:00Z' }),
  ]
  const transitions = deriveTransitions(sorted)
  const map = attachMoverToLatest(transitions, 42, '2020-02-01T00:00:00Z')
  assert.equal(map.get(2), 42)
  assert.equal(map.has(1), false)
})

test('attachMoverToLatest is a no-op when movedBy/movedTime are absent', () => {
  const transitions = deriveTransitions([record({ id: 1 })])
  assert.equal(attachMoverToLatest(transitions, null, null).size, 0)
  assert.equal(attachMoverToLatest(transitions, 5, null).size, 0)
})

test('attachMoverToLatest refuses to attribute when no record is close enough to movedTime', () => {
  const transitions = deriveTransitions([record({ id: 1, createdAt: '2020-01-01T00:00:00Z' })])
  const map = attachMoverToLatest(transitions, 42, '2021-01-01T00:00:00Z')
  assert.equal(map.size, 0)
})

test('resolveStageLabel falls back honestly for a deleted/renamed stage', () => {
  const labels = new Map<string, StageStatusRecord>([
    ['0:NEW', { statusId: 'NEW', name: 'New', color: null, semantics: null }],
  ])
  assert.equal(resolveStageLabel(labels, 0, 'NEW'), 'New')
  assert.equal(resolveStageLabel(labels, 0, 'PREPARATION'), 'Unknown stage (PREPARATION)')
})

test('formatEntry: first entry shows an honest "no previous stage" value, not a guess', () => {
  const transitions = deriveTransitions([record({ id: 1, stageId: 'NEW' })])
  const labels = new Map<string, StageStatusRecord>([
    ['0:NEW', { statusId: 'NEW', name: 'New', color: null, semantics: null }],
  ])
  const entry = formatEntry(transitions[0], labels, new Map(), new Map())
  assert.equal(entry.oldValue.raw, null)
  assert.equal(entry.oldValue.label, 'Previous stage unavailable')
  assert.equal(entry.newValue.label, 'New')
  assert.equal(entry.changedByName, null)
})

test('formatEntry: attributes the actor only when a mover mapping exists, else "User unavailable" upstream', () => {
  const transitions = deriveTransitions([record({ id: 1 })])
  const moverMap = new Map([[1, 42]])
  const userNames = new Map([[42, 'Jane Doe']])
  const entry = formatEntry(transitions[0], new Map(), moverMap, userNames)
  assert.equal(entry.changedById, 42)
  assert.equal(entry.changedByName, 'Jane Doe')
})

test('formatEntry: falls back to "User #<id>" when the user lookup failed', () => {
  const transitions = deriveTransitions([record({ id: 1 })])
  const moverMap = new Map([[1, 42]])
  const entry = formatEntry(transitions[0], new Map(), moverMap, new Map())
  assert.equal(entry.changedByName, 'User #42')
})

test('formatEntry: stableId is derived from the record id, not array position', () => {
  const transitions = deriveTransitions([record({ id: 999 })])
  const entry = formatEntry(transitions[0], new Map(), new Map(), new Map())
  assert.equal(entry.stableId, 'stage-999')
})

test('paginate: hasMore is true while more items remain past the slice', () => {
  const items = Array.from({ length: 5 }, (_, i) => i)
  const first = paginate(items, 0, 2)
  assert.deepEqual(first.page, [0, 1])
  assert.equal(first.hasMore, true)

  const last = paginate(items, 4, 2)
  assert.deepEqual(last.page, [4])
  assert.equal(last.hasMore, false)
})

test('paginate: an exact-multiple collection ends with hasMore false on the final full page', () => {
  const items = [0, 1, 2, 3]
  const page = paginate(items, 2, 2)
  assert.deepEqual(page.page, [2, 3])
  assert.equal(page.hasMore, false)
})

test('end-to-end: a realistic history (verified shape) sorts, derives previous stage and dedupes nothing extra', () => {
  // Shape verified live against GET /v1/stage-history?entityType=deal&ownerId=368
  const raw: StageHistoryRecord[] = [
    { id: 1742, typeId: 3, ownerId: 368, createdAt: '2021-02-04T14:39:32+03:00', categoryId: 0, stageSemanticId: 'S', stageId: 'WON' },
    { id: 1592, typeId: 2, ownerId: 368, createdAt: '2020-12-08T19:08:19+03:00', categoryId: 0, stageSemanticId: 'P', stageId: '4' },
    { id: 1472, typeId: 2, ownerId: 368, createdAt: '2020-11-16T13:01:28+03:00', categoryId: 0, stageSemanticId: 'P', stageId: '1' },
    { id: 1430, typeId: 2, ownerId: 368, createdAt: '2020-11-16T12:46:11+03:00', categoryId: 0, stageSemanticId: 'P', stageId: 'PREPARATION' },
    { id: 1428, typeId: 1, ownerId: 368, createdAt: '2020-11-16T12:46:10+03:00', categoryId: 0, stageSemanticId: 'P', stageId: 'NEW' },
  ]
  const sorted = sortAscending(raw)
  assert.deepEqual(
    sorted.map((r) => r.id),
    [1428, 1430, 1472, 1592, 1742],
  )

  const transitions = deriveTransitions(sorted)
  assert.equal(transitions[0].previous, null)
  assert.equal(transitions[1].previous?.stageId, 'NEW')
  assert.equal(transitions[4].previous?.stageId, '4')

  const labels = new Map<string, StageStatusRecord>([
    ['0:NEW', { statusId: 'NEW', name: 'Eingang', color: null, semantics: null }],
    ['0:4', { statusId: '4', name: 'Orange', color: null, semantics: null }],
    ['0:WON', { statusId: 'WON', name: 'Vertrag unterschieben', color: null, semantics: 'S' }],
    // PREPARATION and "1" intentionally absent — both were removed/renamed since 2020,
    // confirmed live: the current DEAL_STAGE list no longer contains them.
  ])
  const entries = transitions.map((t) => formatEntry(t, labels, new Map(), new Map()))
  assert.equal(entries[1].newValue.label, 'Unknown stage (PREPARATION)')
  assert.equal(entries[2].newValue.label, 'Unknown stage (1)')
  assert.equal(entries[4].newValue.label, 'Vertrag unterschieben')
  assert.equal(entries[4].semantics, 'S')
})
