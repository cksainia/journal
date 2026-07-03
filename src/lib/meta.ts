import { arrayUnion, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { FAMILY_ID } from './constants'

/**
 * journalMeta/{familyId} — small shared doc for the word-collector shelf,
 * favorite sentences, parent notes, and settings (see stores/settings.ts).
 * Kept to merge-writes on distinct keys so writers never clobber each other.
 */

export interface FavoriteSentence {
  weekStart: string
  sentence: string
  dateKey: string
}

export const metaRef = () => doc(db, 'journalMeta', FAMILY_ID)

/** Word collector (spec §4.4): interesting words she used or learned. */
export async function addWordsToShelf(words: string[]): Promise<void> {
  const clean = words.map((w) => w.trim().toLowerCase()).filter((w) => /^[a-z''-]{2,24}$/i.test(w))
  if (!clean.length) return
  await setDoc(metaRef(), { wordShelf: arrayUnion(...clean) }, { merge: true })
}

export async function saveFavoriteSentence(fav: FavoriteSentence): Promise<void> {
  await setDoc(metaRef(), { favoriteSentences: arrayUnion(fav) }, { merge: true })
}

export async function saveParentNote(weekStart: string, note: string): Promise<void> {
  await setDoc(metaRef(), { parentNotes: { [weekStart]: note } }, { merge: true })
}

/** Book response mode (spec §4.2A): remember what she's currently reading. */
export async function saveCurrentBook(title: string): Promise<void> {
  await setDoc(metaRef(), { currentBook: title.trim() }, { merge: true })
}

export interface JournalMeta {
  wordShelf?: string[]
  favoriteSentences?: FavoriteSentence[]
  parentNotes?: Record<string, string>
  currentBook?: string
  kidVoiceCard?: string // copied from weekly insights — the ONLY insight the child sees
}

export function watchMeta(cb: (meta: JournalMeta) => void) {
  return onSnapshot(metaRef(), (snap) => cb(snap.exists() ? (snap.data() as JournalMeta) : {}))
}
