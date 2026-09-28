// Durable app state (JSON file, atomic write) in a persistent dataDirs directory.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = process.env.DATA_DIR || './data'
const FILE = join(DIR, 'state.json')

export function loadState() {
  mkdirSync(DIR, { recursive: true })
  try {
    const s = JSON.parse(readFileSync(FILE, 'utf8'))
    s.invoices ??= {}
    return s
  } catch {
    // First start: only invoices modified from now on are processed (no retroactive bulk run).
    const now = new Date().toISOString()
    const s = { installedAt: now, cursor: now, invoices: {} }
    saveState(s)
    return s
  }
}

export function saveState(s) {
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(s))
  renameSync(tmp, FILE)
}
