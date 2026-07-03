/**
 * Silent typing-fluency tracking (spec §6.2, "Active WPM"). Elapsed time counts
 * ONLY while keystrokes occur within a rolling 3-second window — thinking
 * pauses are excluded. Parent-dashboard-only; the child never sees this.
 */
const WINDOW_MS = 3000

export class ActiveWpmTracker {
  private activeMs = 0
  private lastKeystroke: number | null = null

  keystroke(now: number = Date.now()): void {
    if (this.lastKeystroke !== null) {
      const gap = now - this.lastKeystroke
      if (gap > 0 && gap <= WINDOW_MS) this.activeMs += gap
    }
    this.lastKeystroke = now
  }

  /** Words-per-active-minute; null until there's enough signal to be meaningful. */
  wpm(wordCount: number): number | null {
    if (this.activeMs < 5000 || wordCount < 3) return null
    return wordCount / (this.activeMs / 60000)
  }
}
