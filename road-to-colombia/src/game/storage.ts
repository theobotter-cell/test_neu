import { STORAGE_KEYS } from './config';
import type { RunResult } from './types';

/**
 * Thin wrapper around localStorage. All reads/writes are try/catch guarded
 * because localStorage can throw (private browsing, disabled storage,
 * quota) — the game must keep working, just without persistence, in that
 * case. No server or account is required or used.
 */
function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore — persistence is a nice-to-have, not a requirement to play.
  }
}

export function getBestDistanceM(): number {
  const raw = safeGetItem(STORAGE_KEYS.bestDistanceM);
  const parsed = raw ? Number.parseFloat(raw) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Persists the run's distance as the new best if it beats the current one. */
export function recordRunResult(distanceM: number): RunResult {
  const previousBest = getBestDistanceM();
  const isNewRecord = distanceM > previousBest;
  const bestDistanceM = isNewRecord ? distanceM : previousBest;
  if (isNewRecord) {
    safeSetItem(STORAGE_KEYS.bestDistanceM, String(bestDistanceM));
  }
  return { distanceM, bestDistanceM, isNewRecord };
}

export function getLastCharacterId(): string | null {
  return safeGetItem(STORAGE_KEYS.lastCharacterId);
}

export function setLastCharacterId(id: string): void {
  safeSetItem(STORAGE_KEYS.lastCharacterId, id);
}
