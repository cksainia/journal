import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentReference,
  type CollectionReference,
} from 'firebase/firestore'
import { db } from './firebase'
import { FAMILY_ID, CHILD_UID } from './constants'
import { compactDateKey, dateKeyFor, deviceTimezone } from './dateKey'
import { countWords, countSentences } from './counting'
import { computeTotals, totalsEqual, type DailyTotals } from './totals'
import { syncDayToTracker, trackerTargetPath, type SyncStatus } from './trackerSync'
import { isStale } from './version'

export { computeTotals, totalsEqual, type DailyTotals }

export type SectionType = 'guided' | 'free' | 'nudge' | 'drawing' | 'comic' | 'photo'
export type SectionStatus = 'draft' | 'saved' | 'archived'

export interface JournalSection {
  id: string
  type: SectionType
  title: string
  prompt: string // nudge/guided prompt text shown above the editor ('' for free)
  text: string // TipTap HTML
  plainText: string
  wordCount: number
  sentenceCount: number
  activeWPM: number | null // silent typing fluency (spec §6.2) — parent-only, never shown to Aria
  reviewCount: number // bumped when a review lands (drives reviewedSections in totals)
  genre: string // guided only: narrative | opinion | informative
  standardsTags: string[]
  sparkleWords: { offered: string[]; used: string[] }
  planningChips: string[]
  status: SectionStatus
  clientId: string
  createdAt?: unknown
  updatedAt?: unknown
}

/** Structured check-in metadata (spec §4.1) stored on the day document. */
export interface Checkin {
  moods: string[]
  location: string | null
  activities: string[]
  somethingElse: string
  dayRating: string | null
  bonus: { question: string; answer: 'yes' | 'no' | null }
}

/** A sticker she placed on her journal page (positions in % of the page). */
export interface Sticker {
  emoji: string
  x: number
  y: number
  rot: number
  size: number
}

export interface JournalDay {
  familyId: string
  childId: string
  dateKey: string
  timezone: string
  checkin: Checkin | null
  dailyTotals: DailyTotals
  streakCredit: boolean
  summerTrackerSync: SyncStatus | null
  stickers?: Sticker[]
  createdAt?: unknown
  updatedAt?: unknown
}

/** Stable per-tab id, stored on sections for conflict handling (spec §7). */
export const clientId: string = (() => {
  if (typeof sessionStorage === 'undefined') return 'test' // node test import
  const existing = sessionStorage.getItem('journal-client-id')
  if (existing) return existing
  const id = crypto.randomUUID()
  sessionStorage.setItem('journal-client-id', id)
  return id
})()

export function dayIdFor(dateKey: string): string {
  return `${FAMILY_ID}_${CHILD_UID}_${compactDateKey(dateKey)}`
}

export function dayRef(dateKey: string): DocumentReference {
  return doc(db, 'journalDays', dayIdFor(dateKey))
}

export function sectionsRef(dateKey: string): CollectionReference {
  return collection(db, 'journalDays', dayIdFor(dateKey), 'sections')
}

const EMPTY_TOTALS: DailyTotals = {
  words: 0,
  sentences: 0,
  sections: 0,
  reviewedSections: 0,
  drawings: 0,
}

/** Create today's day document if it doesn't exist yet. Idempotent, 1 read + ≤1 write. */
export async function ensureDay(dateKey: string = dateKeyFor()): Promise<void> {
  const ref = dayRef(dateKey)
  const snap = await getDoc(ref)
  if (snap.exists()) return
  const day: JournalDay = {
    familyId: FAMILY_ID,
    childId: CHILD_UID,
    dateKey,
    timezone: deviceTimezone(),
    checkin: null,
    dailyTotals: EMPTY_TOTALS,
    streakCredit: false,
    summerTrackerSync: null,
  }
  await setDoc(ref, { ...day, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
}

/** Save the check-in onto the day doc (creates the day if needed). */
export async function saveCheckin(dateKey: string, checkin: Checkin): Promise<void> {
  await ensureDay(dateKey)
  await updateDoc(dayRef(dateKey), { checkin, updatedAt: serverTimestamp() })
}

/** Persist her page stickers (whole-array write — a page holds a handful). */
export async function saveStickers(dateKey: string, stickers: Sticker[]): Promise<void> {
  if (isStale()) return // whole-array write from old code could drop newer stickers
  await updateDoc(dayRef(dateKey), { stickers, updatedAt: serverTimestamp() })
}

export interface CreateSectionOpts {
  title?: string
  prompt?: string
  genre?: string
  standardsTags?: string[]
  sparkleWords?: string[]
  planningChips?: string[]
}

export async function createSection(
  dateKey: string,
  type: SectionType,
  opts: CreateSectionOpts = {},
): Promise<string> {
  await ensureDay(dateKey)
  const ref = doc(sectionsRef(dateKey))
  const section: JournalSection = {
    id: ref.id,
    type,
    title: opts.title ?? '',
    prompt: opts.prompt ?? '',
    text: '',
    plainText: '',
    wordCount: 0,
    sentenceCount: 0,
    activeWPM: null,
    reviewCount: 0,
    genre: opts.genre ?? '',
    standardsTags: opts.standardsTags ?? [],
    sparkleWords: { offered: opts.sparkleWords ?? [], used: [] },
    planningChips: opts.planningChips ?? [],
    status: 'draft',
    clientId,
  }
  await setDoc(ref, { ...section, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return ref.id
}

/** Persist editor content. Counts are computed here, client-side, on every save. */
export async function saveSectionText(
  dateKey: string,
  sectionId: string,
  html: string,
  plainText: string,
  status: SectionStatus = 'draft',
  extras: { activeWPM?: number | null; sparkleUsed?: string[] } = {},
): Promise<void> {
  await updateDoc(doc(sectionsRef(dateKey), sectionId), {
    text: html,
    plainText,
    wordCount: countWords(plainText),
    sentenceCount: countSentences(plainText),
    status,
    clientId,
    ...(extras.activeWPM != null ? { activeWPM: Math.round(extras.activeWPM) } : {}),
    ...(extras.sparkleUsed?.length ? { 'sparkleWords.used': extras.sparkleUsed } : {}),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Write-frugal totals update + Summer Tracker sync (spec §8) in one choke
 * point: recompute → sync claim → record status. Callers compare with
 * totalsEqual first, so this runs only when the numbers actually changed —
 * and the tracker gets exactly one merge-write per real change.
 */
export async function updateDayTotals(dateKey: string, totals: DailyTotals): Promise<SyncStatus> {
  // VERSION GATE: a stale tab never writes derived/shared values. Content is
  // already saved; totals + the tracker claim recompute after a refresh.
  if (isStale()) {
    return {
      status: 'error',
      targetPath: trackerTargetPath(dateKey),
      syncedSentences: totals.sentences,
      lastSyncedAt: Date.now(),
      error: 'this tab is running an old version — refresh to sync',
    }
  }
  const sync = await syncDayToTracker(db, dateKey, totals)
  await updateDoc(dayRef(dateKey), {
    dailyTotals: totals,
    streakCredit: totals.sentences > 0 || totals.drawings > 0,
    summerTrackerSync: sync,
    updatedAt: serverTimestamp(),
  })
  return sync
}

/** Manual "Retry sync" (parent dashboard): re-read live sections, recompute, re-sync. */
export async function retryTrackerSync(dateKey: string): Promise<SyncStatus> {
  const { getDocs } = await import('firebase/firestore')
  const snap = await getDocs(sectionsRef(dateKey))
  const sections = snap.docs.map((d) => d.data() as JournalSection)
  return updateDayTotals(dateKey, computeTotals(sections))
}

/** Parent entry management (spec §11: child archives, parent deletes/restores). */
export async function setSectionStatus(
  dateKey: string,
  sectionId: string,
  status: SectionStatus,
): Promise<void> {
  await updateDoc(doc(sectionsRef(dateKey), sectionId), { status, updatedAt: serverTimestamp() })
  await retryTrackerSync(dateKey) // totals + tracker claim follow the change
}

/** Hard delete (PARENT ONLY, rules-enforced): removes the section AND its
 *  reviews (Firestore doesn't cascade), then recomputes totals + sync. */
export async function deleteSectionForever(dateKey: string, sectionId: string): Promise<void> {
  await applySectionActions([{ dateKey, sectionId }], 'delete')
}

/** Batch entry actions: apply to every item, then recompute totals + tracker
 *  sync ONCE per affected day (not once per entry). */
export async function applySectionActions(
  items: { dateKey: string; sectionId: string }[],
  action: 'archive' | 'restore' | 'delete',
): Promise<void> {
  const { deleteDoc, getDocs, collection: coll } = await import('firebase/firestore')
  for (const { dateKey, sectionId } of items) {
    if (action === 'delete') {
      const reviewsSnap = await getDocs(
        coll(db, 'journalDays', dayIdFor(dateKey), 'sections', sectionId, 'reviews'),
      )
      await Promise.all(reviewsSnap.docs.map((r) => deleteDoc(r.ref)))
      await deleteDoc(doc(sectionsRef(dateKey), sectionId))
    } else {
      await updateDoc(doc(sectionsRef(dateKey), sectionId), {
        status: action === 'archive' ? 'archived' : 'saved',
        updatedAt: serverTimestamp(),
      })
    }
  }
  for (const dateKey of new Set(items.map((i) => i.dateKey))) {
    await retryTrackerSync(dateKey)
  }
}

/** Move entries to a different day (PARENT ONLY — e.g. paper-journal imports
 *  landed on the wrong date). Copies the section AND its reviews to the target
 *  day, deletes the original, then recomputes totals + tracker sync for every
 *  day that changed. */
export async function moveSections(
  items: { dateKey: string; sectionId: string }[],
  toDateKey: string,
): Promise<void> {
  const { deleteDoc, getDocs, collection: coll } = await import('firebase/firestore')
  const touched = new Set<string>([toDateKey])
  for (const { dateKey, sectionId } of items) {
    if (dateKey === toDateKey) continue
    const srcRef = doc(sectionsRef(dateKey), sectionId)
    const snap = await getDoc(srcRef)
    if (!snap.exists()) continue
    await ensureDay(toDateKey)
    const destRef = doc(sectionsRef(toDateKey))
    await setDoc(destRef, { ...snap.data(), id: destRef.id, updatedAt: serverTimestamp() })
    const reviewsSnap = await getDocs(
      coll(db, 'journalDays', dayIdFor(dateKey), 'sections', sectionId, 'reviews'),
    )
    for (const r of reviewsSnap.docs) {
      await setDoc(
        doc(coll(db, 'journalDays', dayIdFor(toDateKey), 'sections', destRef.id, 'reviews')),
        r.data(),
      )
      await deleteDoc(r.ref)
    }
    await deleteDoc(srcRef)
    touched.add(dateKey)
  }
  for (const dateKey of touched) await retryTrackerSync(dateKey)
}
