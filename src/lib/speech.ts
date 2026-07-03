/** "Read It Aloud" (spec §4.5) — the highest-leverage self-editing scaffold:
 *  she hears her own missing words and run-ons before any AI sees the text. */

export function speak(text: string, onEnd?: () => void): boolean {
  if (!('speechSynthesis' in window) || !text.trim()) return false
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.95
  u.pitch = 1.05
  if (onEnd) u.onend = onEnd
  window.speechSynthesis.speak(u)
  return true
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export function isSpeaking(): boolean {
  return 'speechSynthesis' in window && window.speechSynthesis.speaking
}
