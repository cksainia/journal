import {
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import { dayIdFor, dayRef, sectionsRef } from './journal'
import type { Review } from '@/services/claude/types'

/**
 * Review persistence (spec §7 reviews subcollection). Each review stores the
 * validated Claude payload plus the child's per-correction outcomes
 * ("used" / "skipped" / "selfFixed") — the raw material for the parent
 * dashboard's revision-rate metric. Rate limiting rides day.reviewsUsed.
 */

export type CorrectionOutcome = 'used' | 'skipped' | 'selfFixed'

export interface StoredReview extends Review {
  id: string
  reviewType: 'initial' | 'recheck'
  model: string
  grammarByCategory: Record<string, number>
  correctionOutcomes: Record<string, CorrectionOutcome>
  postFixRecheck: { spelling: number; grammar: number } | null
  createdAt?: unknown
}

export function reviewsRef(dateKey: string, sectionId: string) {
  return collection(db, 'journalDays', dayIdFor(dateKey), 'sections', sectionId, 'reviews')
}

export async function saveReview(
  dateKey: string,
  sectionId: string,
  review: Review,
  reviewType: 'initial' | 'recheck',
  model: string,
): Promise<string> {
  const ref = doc(reviewsRef(dateKey, sectionId))
  const grammarByCategory: Record<string, number> = {}
  review.corrections.forEach((c) => {
    if (c.type !== 'spelling') grammarByCategory[c.category] = (grammarByCategory[c.category] || 0) + 1
  })
  await setDoc(ref, {
    ...review,
    reviewType,
    model,
    grammarByCategory,
    correctionOutcomes: {},
    postFixRecheck: null,
    createdAt: serverTimestamp(),
  })
  await updateDoc(doc(sectionsRef(dateKey), sectionId), {
    reviewCount: increment(1),
    ...(review.sparkle_words_used.length ? { 'sparkleWords.used': review.sparkle_words_used } : {}),
  })
  await updateDoc(dayRef(dateKey), { reviewsUsed: increment(1) })
  return ref.id
}

export async function recordOutcome(
  dateKey: string,
  sectionId: string,
  reviewId: string,
  correctionId: string,
  outcome: CorrectionOutcome,
): Promise<void> {
  await updateDoc(doc(reviewsRef(dateKey, sectionId), reviewId), {
    [`correctionOutcomes.${correctionId}`]: outcome,
  })
}

export async function recordRecheck(
  dateKey: string,
  sectionId: string,
  reviewId: string,
  counts: { spelling: number; grammar: number },
): Promise<void> {
  await updateDoc(doc(reviewsRef(dateKey, sectionId), reviewId), { postFixRecheck: counts })
}

/** Reviews used today, for the parent-configurable daily cap (spec §9). */
export async function reviewsUsedToday(dateKey: string): Promise<number> {
  const snap = await getDoc(dayRef(dateKey))
  return snap.exists() ? ((snap.data().reviewsUsed as number) ?? 0) : 0
}
