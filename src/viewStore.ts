import { promises as fs } from 'fs'
import path from 'path'
import { config } from './config'
import { ViewStoreEntry, ViewStoreFile } from './types'

const STORE_PATH = path.join(config.dataDir, 'views.json')

// Serializes read-modify-write cycles so concurrent requests never race on the file.
let writeQueue: Promise<unknown> = Promise.resolve()

// Short-lived de-dupe of view nonces, in addition to the frontend only firing
// the view event once per page load. Belt-and-braces against retried requests.
const seenNonces = new Map<string, number>()
const NONCE_TTL_MS = 10 * 60 * 1000

function pruneNonces(): void {
  const now = Date.now()
  for (const [key, expiresAt] of seenNonces) {
    if (expiresAt <= now) seenNonces.delete(key)
  }
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(config.dataDir, { recursive: true })
}

async function readStore(): Promise<ViewStoreFile> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    return JSON.parse(raw) as ViewStoreFile
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { trackingSince: new Date().toISOString(), contacts: {} }
    }
    throw err
  }
}

async function writeStoreAtomic(store: ViewStoreFile): Promise<void> {
  await ensureDataDir()
  const tmpPath = `${STORE_PATH}.tmp-${process.pid}`
  await fs.writeFile(tmpPath, JSON.stringify(store), 'utf8')
  await fs.rename(tmpPath, STORE_PATH)
}

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn, fn)
  // Swallow rejections in the chain itself so one failed write doesn't wedge the queue.
  writeQueue = result.catch(() => undefined)
  return result
}

export async function getTrackingSince(): Promise<string> {
  const store = await readStore()
  return store.trackingSince
}

export async function getViewCount(contactId: number): Promise<{ views: number; trackingSince: string }> {
  const store = await readStore()
  const entry = store.contacts[String(contactId)]
  return { views: entry?.totalViews ?? 0, trackingSince: store.trackingSince }
}

/**
 * Records one Contact Insights tab open. Idempotent per (contactId, nonce) within
 * a short TTL window so a duplicate client call never double-counts one opening.
 */
export async function recordView(
  contactId: number,
  nonce: string,
): Promise<{ views: number; trackingSince: string; deduped: boolean }> {
  pruneNonces()
  const dedupeKey = `${contactId}:${nonce}`
  if (seenNonces.has(dedupeKey)) {
    const { views, trackingSince } = await getViewCount(contactId)
    return { views, trackingSince, deduped: true }
  }
  seenNonces.set(dedupeKey, Date.now() + NONCE_TTL_MS)

  return withWriteLock(async () => {
    const store = await readStore()
    const now = new Date().toISOString()
    const key = String(contactId)
    const existing: ViewStoreEntry | undefined = store.contacts[key]

    const entry: ViewStoreEntry = existing
      ? { ...existing, totalViews: existing.totalViews + 1, lastViewedAt: now }
      : { contactId, totalViews: 1, firstTrackedAt: now, lastViewedAt: now }

    store.contacts[key] = entry
    await writeStoreAtomic(store)
    return { views: entry.totalViews, trackingSince: store.trackingSince, deduped: false }
  })
}
