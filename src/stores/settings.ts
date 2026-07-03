import { create } from 'zustand'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { FAMILY_ID, DEFAULT_SENTENCE_GOAL } from '@/lib/constants'

/**
 * App settings live in journalMeta/{familyId}.settings — parent-managed (PIN
 * UX gate), synced across devices. AI stays 'mock' until the parent deploys
 * the Claude Worker (Phase 4 live activation) and flips it in settings.
 */
export interface JournalSettings {
  aiMode: 'mock' | 'live'
  workerUrl: string
  sentenceGoal: number
  reviewsPerDay: number
  noStreakPressure: boolean
  streakFreezeDays: number
  safetyScanning: boolean
  pinHash: string | null
}

export const DEFAULT_SETTINGS: JournalSettings = {
  aiMode: 'mock',
  workerUrl: '',
  sentenceGoal: DEFAULT_SENTENCE_GOAL,
  reviewsPerDay: 10,
  noStreakPressure: false,
  streakFreezeDays: 1,
  safetyScanning: true,
  pinHash: null,
}

interface SettingsState {
  settings: JournalSettings
  loaded: boolean
  save: (patch: Partial<JournalSettings>) => Promise<void>
}

const metaRef = () => doc(db, 'journalMeta', FAMILY_ID)

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  async save(patch) {
    const next = { ...get().settings, ...patch }
    set({ settings: next })
    await setDoc(metaRef(), { settings: next }, { merge: true })
  },
}))

// Attached by the session store AFTER sign-in — an unauthenticated listener
// would only harvest permission-denied errors.
let stop: (() => void) | null = null
export function startSettingsSync(): void {
  if (stop) return
  stop = onSnapshot(
    metaRef(),
    (snap) => {
      const stored = snap.exists() ? (snap.data().settings as Partial<JournalSettings>) : {}
      useSettings.setState({ settings: { ...DEFAULT_SETTINGS, ...stored }, loaded: true })
    },
    (e) => console.warn('settings listener:', e.message),
  )
}
export function stopSettingsSync(): void {
  stop?.()
  stop = null
  useSettings.setState({ settings: DEFAULT_SETTINGS, loaded: false })
}

/** SHA-256 for the parent PIN — a UX gate only, never the security boundary. */
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode('aria-journal:' + pin)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
