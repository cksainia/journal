/**
 * Client-side word/sentence counting (spec §7): words = whitespace tokens,
 * sentences = terminal-punctuation splits with cleanup. Claude's counts are
 * secondary validation only — these numbers drive stats and tracker sync.
 */
export function countWords(plainText: string): number {
  const t = plainText.trim()
  return t ? t.split(/\s+/).length : 0
}

export function countSentences(plainText: string): number {
  const t = plainText.trim()
  if (!t) return 0
  // Split on runs of terminal punctuation; a trailing fragment without
  // punctuation still counts (kids often skip the last period).
  return t
    .split(/[.!?…]+/)
    .map((s) => s.trim())
    .filter((s) => /[\p{L}\p{N}]/u.test(s)).length
}
