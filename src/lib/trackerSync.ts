import { doc, setDoc, type Firestore } from 'firebase/firestore'
import type { DailyTotals } from './totals'

/**
 * Summer Tracker sync adapter (spec §8 + Phase 0 contract).
 *
 * Target: families/aria-claims → journal.<dateKey> = day's total sentence
 * count across all LIVE sections. This is the tracker's existing "Aria claims"
 * path — the parent's Accept flow in the tracker is unchanged.
 *
 * Properties:
 * - ABSOLUTE, recomputed value (never incremented) → idempotent; edits update,
 *   never duplicate; archive/restore handled by recompute upstream.
 * - Merge-write touches ONLY journal.<dateKey> — other claim maps (comp, hab,
 *   beast, ixl, gratitude) and other journal dates are preserved.
 * - dateKey is device-local YYYY-MM-DD (both apps' convention), so a Dubai
 *   11 PM entry and the next NJ-morning entry land on different keys.
 * - Client-side by design (house pattern; no Cloud Functions on Spark plan).
 *   The single call site is the day-totals recompute choke point, and the
 *   status is recorded on the day doc for the parent dashboard + manual retry.
 *
 * Known race (documented in PHASE0-DISCOVERY.md): the tracker writes the
 * claims doc whole from device state, so a stale open tracker tab can clobber
 * a synced value until the next recompute self-heals it. The tracker-side v30
 * merge patch eliminates this; until then the adapter re-syncs on every
 * section change and on manual retry.
 *
 * Future fields (words, accuracy) go in the payload builder below — additive.
 */

export const TRACKER_FAMILY_DOC = 'aria-claims'
export const trackerTargetPath = (dateKey: string) =>
  `families/${TRACKER_FAMILY_DOC} → journal.${dateKey}`

export interface SyncStatus {
  status: 'synced' | 'error'
  targetPath: string
  syncedSentences: number
  lastSyncedAt: number // client epoch ms (serverTimestamp not allowed inside merge maps we compare)
  error: string | null
}

/** The one write to tracker territory. Exported separately so emulator tests
 *  exercise the exact production write shape. */
export async function writeTrackerClaim(
  db: Firestore,
  dateKey: string,
  sentences: number,
): Promise<void> {
  await setDoc(
    doc(db, 'families', TRACKER_FAMILY_DOC),
    { journal: { [dateKey]: sentences } },
    { merge: true },
  )
}

export async function syncDayToTracker(
  db: Firestore,
  dateKey: string,
  totals: DailyTotals,
): Promise<SyncStatus> {
  const base = {
    targetPath: trackerTargetPath(dateKey),
    syncedSentences: totals.sentences,
    lastSyncedAt: Date.now(),
  }
  try {
    await writeTrackerClaim(db, dateKey, totals.sentences)
    return { ...base, status: 'synced', error: null }
  } catch (e) {
    return { ...base, status: 'error', error: (e as Error).message || 'unknown error' }
  }
}
