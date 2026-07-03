import { create } from 'zustand'

/**
 * VERSION GATE (the Summer Tracker's stale-tab defense, ported): a tab left
 * open on another device keeps running old code after a deploy. Old code must
 * never clobber newer data, so every tab compares its compiled-in build stamp
 * against the freshly deployed version.json — on app start, whenever the tab
 * wakes up (visibility/focus/online), and every 10 minutes.
 *
 * When stale: SHARED and DERIVED writes pause (tracker sync, day totals,
 * settings, stickers, word shelf) and a friendly banner offers a one-tap
 * refresh. Her OWN content autosaves (section text, check-in, reviews) keep
 * working — a stale tab writing her current typing is correct data, and
 * writing must never be blocked or lost (spec §2). The paused derived values
 * self-heal after refresh: the sync adapter recomputes absolutes on the next
 * edit.
 */

declare const __APP_BUILD__: number

interface VersionState {
  stale: boolean
}

export const useVersion = create<VersionState>(() => ({ stale: false }))

/** Gate for shared/derived writes. Content writes must NOT use this. */
export function isStale(): boolean {
  return useVersion.getState().stale
}

async function check(): Promise<void> {
  if (import.meta.env.DEV || useVersion.getState().stale) return
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?cb=${Date.now()}`, {
      cache: 'no-store',
    })
    if (!res.ok) return // first deploy without version.json, offline, etc. — never assume stale
    const { build } = (await res.json()) as { build?: number }
    if (typeof build === 'number' && build > __APP_BUILD__) {
      useVersion.setState({ stale: true })
      console.warn(`stale tab: running build ${__APP_BUILD__}, deployed is ${build} — shared writes paused`)
    }
  } catch {
    /* network hiccup — stay optimistic, we'll check again */
  }
}

export function startVersionWatch(): void {
  if (import.meta.env.DEV) return
  void check()
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check()
  })
  window.addEventListener('focus', () => void check())
  window.addEventListener('online', () => void check())
  setInterval(() => void check(), 10 * 60 * 1000)
}
