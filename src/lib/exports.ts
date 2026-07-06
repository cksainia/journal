import type { DayBundle } from './analytics'
import { CHILD_NAME } from './constants'

/**
 * Exports (spec §12): CSV daily stats, JSON full backup, printable keepsake
 * (browser print → PDF). Archived sections are EXCLUDED unless the parent
 * explicitly opts in. No child-initiated sharing anywhere.
 */

function download(filename: string, mime: string, content: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: mime }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

const csvEscape = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`

export function exportCsv(bundles: DayBundle[]) {
  const header = [
    'dateKey', 'timezone', 'words', 'sentences', 'sections', 'reviewedSections', 'drawings',
    'moods', 'location', 'dayRating', 'genres', 'standardsTags', 'reviews', 'spellingErrors', 'grammarErrors',
  ]
  const rows = bundles.map((b) => {
    const initial = b.reviews.filter((r) => r.reviewType === 'initial')
    const live = b.sections.filter((s) => s.status !== 'archived')
    return [
      b.day.dateKey,
      b.day.timezone,
      b.day.dailyTotals.words,
      b.day.dailyTotals.sentences,
      b.day.dailyTotals.sections,
      b.day.dailyTotals.reviewedSections,
      b.day.dailyTotals.drawings,
      (b.day.checkin?.moods ?? []).join('|'),
      b.day.checkin?.location ?? '',
      b.day.checkin?.dayRating ?? '',
      [...new Set(live.map((s) => s.genre).filter(Boolean))].join('|'),
      [...new Set(live.flatMap((s) => s.standardsTags ?? []))].join('|'),
      initial.length,
      initial.reduce((n, r) => n + r.counts.spelling, 0),
      initial.reduce((n, r) => n + r.counts.grammar, 0),
    ].map(csvEscape).join(',')
  })
  download(`aria-journal-stats-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv', [header.join(','), ...rows].join('\n'))
}

export function exportJson(bundles: DayBundle[], includeArchived: boolean) {
  const data = bundles.map((b) => ({
    ...b,
    sections: b.sections.filter((s) => includeArchived || s.status !== 'archived'),
  }))
  download(
    `aria-journal-backup-${new Date().toISOString().slice(0, 10)}.json`,
    'application/json',
    JSON.stringify({ exportedAt: new Date().toISOString(), includeArchived, days: data }, null, 2),
  )
}

/** Printable keepsake "journal book" — opens a print view; Save-as-PDF from there. */
export function openKeepsake(bundles: DayBundle[], includeArchived: boolean) {
  const days = bundles.filter(
    (b) =>
      b.sections.some((s) => includeArchived || s.status !== 'archived') ||
      (b.day.loveNotes?.length ?? 0) > 0,
  )
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const pretty = (dk: string) =>
    new Date(dk + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const body = days
    .map((b) => {
      const sections = b.sections
        .filter((s) => includeArchived || s.status !== 'archived')
        .map((s) => {
          const panels = (s.panels ?? []).map((p) => `<img src="${p.image}" alt="${esc(p.caption)}" />`).join('')
          return `<div class="section">
            ${s.prompt ? `<p class="prompt">${esc(s.prompt)}</p>` : ''}
            ${panels ? `<div class="panels">${panels}</div>` : ''}
            ${s.plainText ? `<p class="text">${esc(s.plainText)}</p>` : ''}
          </div>`
        })
        .join('')
      const moods = (b.day.checkin?.moods ?? []).join(', ')
      const loveNotes = (b.day.loveNotes ?? [])
        .map((n) => `<p class="love love-${n.from === 'mom' ? 'mom' : 'dad'}">💌 ${n.from === 'dad' ? 'Dad' : 'Mom'} says: ${esc(n.text)}</p>`)
        .join('')
      return `<article>
        <h2>${pretty(b.day.dateKey)}</h2>
        ${moods ? `<p class="meta">Feeling: ${esc(moods)}</p>` : ''}
        ${sections}
        ${loveNotes}
      </article>`
    })
    .join('')

  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(`<!doctype html><html><head><title>${CHILD_NAME}'s Journal — Keepsake</title>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Architects+Daughter&family=Dancing+Script:wght@600&display=swap" rel="stylesheet">
    <style>
      body { font-family: Georgia, serif; color: #2E2A36; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
      h1 { text-align: center; } h2 { border-bottom: 2px solid #F4634A; padding-bottom: 4px; margin-top: 2.5rem; }
      .meta { color: #7A7484; font-style: italic; } .prompt { color: #8F7BE8; font-style: italic; }
      .love { border-radius: 8px; padding: 8px 12px; }
      .love-dad { background: #E3F2FD; color: #1D5FA8; font-family: "Architects Daughter", cursive; font-size: 1.15rem; }
      .love-mom { background: #FDE7F1; color: #C2337E; font-family: "Dancing Script", cursive; font-size: 1.25rem; }
      .text { font-size: 1.1rem; line-height: 1.7; white-space: pre-wrap; }
      .panels { display: flex; gap: 8px; } .panels img { width: 30%; border: 1px solid #EFE4D3; border-radius: 8px; }
      article { break-inside: avoid; }
      @media print { body { margin: 0.5in; } }
    </style></head><body>
    <h1>📖 ${CHILD_NAME}'s Journal</h1>${body}
    <script>window.onload = () => window.print()</script>
    </body></html>`)
  w.document.close()
}
