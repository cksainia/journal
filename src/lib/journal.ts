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

export type SectionType = 'guided' | 'free' | 'nudge' | 'drawing' | 'comic'
export type SectionStatus = 'draft' | 'saved' | 'archived'

export interface JournalSection {
  id: string
  type: SectionType
  title: string
  text: string // TipTap HTML
  plainText: string
  wordCount: number
  sentenceCount: number
  status: SectionStatus
  clientId: string
  createdAt?: unknown
  updatedAt?: unknown
}

export interface DailyTotals {
  words: number
  sentences: number
  sections: number
  reviewedSections: number
  drawings: number
}

export interface JournalDay {
  familyId: string
  childId: string
  dateKey: string
  timezone: string
  checkin: null | Record<string, unknown>
  dailyTotals: DailyTotals
  streakCredit: boolean
  createdAt?: unknown
  updatedAt?: unknown
}

/** Stable per-tab id, stored on sections for conflict handling (spec §7). */
export const clientId: string =
  sessionStorage.getItem('journal-client-id') ??
  (() => {
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
  }
  await setDoc(ref, { ...day, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
}

export async function createSection(
  dateKey: string,
  type: SectionType,
  title = '',
): Promise<string> {
  await ensureDay(dateKey)
  const ref = doc(sectionsRef(dateKey))
  const section: JournalSection = {
    id: ref.id,
    type,
    title,
    text: '',
    plainText: '',
    wordCount: 0,
    sentenceCount: 0,
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
): Promise<void> {
  await updateDoc(doc(sectionsRef(dateKey), sectionId), {
    text: html,
    plainText,
    wordCount: countWords(plainText),
    sentenceCount: countSentences(plainText),
    status,
    clientId,
    updatedAt: serverTimestamp(),
  })
}

/** Recompute day totals from live (non-archived) sections. Deterministic, never increments. */
export function computeTotals(sections: JournalSection[]): DailyTotals {
  const live = sections.filter((s) => s.status !== 'archived')
  return {
    words: live.reduce((n, s) => n + (s.wordCount || 0), 0),
    sentences: live.reduce((n, s) => n + (s.sentenceCount || 0), 0),
    sections: live.length,
    reviewedSections: 0, // reviews land in Phase 4
    drawings: live.filter((s) => s.type === 'drawing' || s.type === 'comic').length,
  }
}

export function totalsEqual(a: DailyTotals, b: DailyTotals): boolean {
  return (
    a.words === b.words &&
    a.sentences === b.sentences &&
    a.sections === b.sections &&
    a.reviewedSections === b.reviewedSections &&
    a.drawings === b.drawings
  )
}

/** Write-frugal totals update: callers compare with totalsEqual first. */
export async function updateDayTotals(dateKey: string, totals: DailyTotals): Promise<void> {
  await updateDoc(dayRef(dateKey), {
    dailyTotals: totals,
    streakCredit: totals.sentences > 0 || totals.drawings > 0,
    updatedAt: serverTimestamp(),
  })
}
