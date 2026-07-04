import { useRef, useState } from 'react'
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { MOODS, RATINGS } from '@/components/CheckIn'
import { useSettings } from '@/stores/settings'
import { fileToDataUrl, downscaleImage } from '@/lib/images'
import { importJournalPage } from '@/services/claude/liveClaudeService'
import {
  createSection,
  dayRef,
  ensureDay,
  retryTrackerSync,
  saveCheckin,
  saveSectionText,
  sectionsRef,
  clientId,
  type JournalDay,
} from '@/lib/journal'
import { countWords, countSentences } from '@/lib/counting'

/**
 * Import her PAPER journal (parent-only): photograph a page, Claude reads the
 * handwriting into structured suggestions, the parent reviews/edits every
 * field, picks the real date, and only then is anything written — her words
 * land verbatim as saved entries, the page photo can ride along as a photo
 * section, and totals + tracker sync recompute for that day.
 */

interface Draft {
  date: string
  moods: string[]
  dayRating: string | null
  entries: { title: string; text: string }[]
  keepPhoto: boolean
  photoCaption: string
  note: string // dayOfWeek / extra feelings the parent may want while dating the page
}

interface PageItem {
  id: number
  image: string // downscaled data URL — shown, OCR'd, and optionally saved
  status: 'ready' | 'reading' | 'review' | 'writing' | 'done' | 'error'
  error?: string
  draft?: Draft
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const toHtml = (text: string) =>
  text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${esc(l)}</p>`)
    .join('')

export function ImportPaperJournal({ onImported }: { onImported: () => void }) {
  const { settings } = useSettings()
  const [open, setOpen] = useState(false)
  const [pages, setPages] = useState<PageItem[]>([])
  const [adding, setAdding] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const nextId = useRef(1)
  const aiReady = settings.aiMode === 'live' && !!settings.workerUrl

  const patch = (id: number, p: Partial<PageItem>) =>
    setPages((ps) => ps.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const patchDraft = (id: number, p: Partial<Draft>) =>
    setPages((ps) => ps.map((x) => (x.id === id && x.draft ? { ...x, draft: { ...x.draft, ...p } } : x)))

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setAdding(true)
    try {
      for (const file of [...files]) {
        const raw = await fileToDataUrl(file)
        // big enough for handwriting OCR, small enough for one Firestore doc
        const image = await downscaleImage(raw, { maxDim: 1400, maxChars: 900_000 })
        setPages((ps) => [...ps, { id: nextId.current++, image, status: 'ready' }])
      }
    } catch (e) {
      console.warn('page add failed:', (e as Error).message)
    } finally {
      setAdding(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function readPage(item: PageItem) {
    patch(item.id, { status: 'reading', error: undefined })
    try {
      const r = await importJournalPage(settings.workerUrl, item.image)
      const knownMoods = r.moods.filter((m) => MOODS.some((x) => x.id === m))
      const extras = [r.dayOfWeek, ...r.extraFeelings].filter(Boolean).join(' · ')
      patch(item.id, {
        status: 'review',
        draft: {
          date: r.date ?? '',
          moods: knownMoods,
          dayRating: RATINGS.some((x) => x.id === r.dayRating) ? r.dayRating : null,
          entries: r.entries.filter((e) => e.text.trim()),
          keepPhoto: r.pageKind !== 'writing',
          photoCaption: r.drawingDescription ?? 'From my paper journal',
          note: extras,
        },
      })
    } catch (e) {
      patch(item.id, { status: 'error', error: (e as Error).message })
    }
  }

  async function writePage(item: PageItem) {
    const d = item.draft
    if (!d?.date) return
    patch(item.id, { status: 'writing' })
    try {
      await ensureDay(d.date)
      // check-in only fills an EMPTY day — imports never clobber real answers
      const daySnap = await getDoc(dayRef(d.date))
      const day = daySnap.data() as JournalDay | undefined
      if (!day?.checkin && (d.moods.length || d.dayRating)) {
        await saveCheckin(d.date, {
          moods: d.moods,
          location: null,
          activities: [],
          somethingElse: '',
          dayRating: d.dayRating,
          bonus: { question: '', answer: null },
        })
      }
      for (const entry of d.entries) {
        if (!entry.text.trim()) continue
        const title = entry.title.trim() || 'From my paper journal'
        const id = await createSection(d.date, 'free', { title, prompt: title })
        await saveSectionText(d.date, id, toHtml(entry.text), entry.text.trim(), 'saved')
      }
      if (d.keepPhoto) {
        const id = await createSection(d.date, 'photo', { title: 'From my paper journal' })
        // caption is the AI's description, not her writing — display it, but
        // keep word/sentence counts at 0 so imported stats stay honest
        await updateDoc(doc(sectionsRef(d.date), id), {
          panels: [{ image: item.image, caption: d.photoCaption.trim() }],
          status: 'saved',
          clientId,
          updatedAt: serverTimestamp(),
        })
      }
      await retryTrackerSync(d.date)
      patch(item.id, { status: 'done' })
      onImported()
    } catch (e) {
      patch(item.id, { status: 'review', error: (e as Error).message })
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle className="text-base">Import her paper journal</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide ▾' : 'Show ▸'}
        </Button>
      </div>
      <p className="text-muted text-xs mt-1">
        Photograph a page, let AI read the handwriting, then review every word and pick the date
        before it lands in her journal. Her words are kept exactly as she wrote them.
      </p>
      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {!aiReady && (
            <p className="text-coral text-sm font-bold">
              Reading pages needs AI mode “live” + a Worker URL (Settings below).
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void addFiles(e.target.files)}
          />
          <div>
            <Button size="sm" variant="secondary" disabled={adding} onClick={() => fileRef.current?.click()}>
              {adding ? 'Adding…' : '📄 Add page photos'}
            </Button>
          </div>

          {pages.map((p) => (
            <div key={p.id} className="border border-line rounded-2xl p-3 flex flex-col gap-2">
              <div className="flex gap-3 items-start">
                <img src={p.image} alt="Journal page" className="w-24 rounded-lg border border-line shrink-0" />
                <div className="flex-1 min-w-0">
                  {p.status === 'ready' && (
                    <Button size="sm" disabled={!aiReady} onClick={() => void readPage(p)}>
                      🔎 Read this page
                    </Button>
                  )}
                  {p.status === 'reading' && <p className="text-sm text-muted">Reading her handwriting…</p>}
                  {p.status === 'writing' && <p className="text-sm text-muted">Adding to her journal…</p>}
                  {p.status === 'done' && <p className="text-sm font-bold text-teal">Imported ✓</p>}
                  {p.status === 'error' && (
                    <div className="text-sm">
                      <p className="text-coral font-bold">Couldn't read this page: {p.error}</p>
                      <Button size="sm" variant="secondary" className="mt-1" onClick={() => void readPage(p)}>
                        Try again
                      </Button>
                    </div>
                  )}
                  {p.status === 'review' && p.error && (
                    <p className="text-coral text-sm font-bold">Import failed: {p.error} — try again.</p>
                  )}
                </div>
                {p.status !== 'writing' && p.status !== 'done' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-coral"
                    onClick={() => setPages((ps) => ps.filter((x) => x.id !== p.id))}
                  >
                    Remove
                  </Button>
                )}
              </div>

              {p.status === 'review' && p.draft && (
                <div className="flex flex-col gap-3 text-sm">
                  {p.draft.note && <p className="text-muted text-xs">On the page: {p.draft.note}</p>}
                  <label className="flex items-center gap-2 font-bold">
                    Entry date
                    <input
                      type="date"
                      value={p.draft.date}
                      onChange={(e) => patchDraft(p.id, { date: e.target.value })}
                      className="min-h-10 px-2 rounded-xl border-2 border-line"
                    />
                    {!p.draft.date && <span className="text-coral font-bold text-xs">required</span>}
                  </label>

                  <div>
                    <p className="font-bold mb-1">Feelings on the page</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MOODS.map((m) => (
                        <Chip
                          key={m.id}
                          active={p.draft!.moods.includes(m.id)}
                          onClick={() =>
                            patchDraft(p.id, {
                              moods: p.draft!.moods.includes(m.id)
                                ? p.draft!.moods.filter((x) => x !== m.id)
                                : [...p.draft!.moods, m.id],
                            })
                          }
                        >
                          {m.emoji} {m.label}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="font-bold mb-1">Day rating</p>
                    <div className="flex flex-wrap gap-1.5">
                      {RATINGS.map((r) => (
                        <Chip
                          key={r.id}
                          active={p.draft!.dayRating === r.id}
                          onClick={() => patchDraft(p.id, { dayRating: p.draft!.dayRating === r.id ? null : r.id })}
                        >
                          {r.emoji} {r.label}
                        </Chip>
                      ))}
                    </div>
                    <p className="text-muted text-xs mt-1">
                      Feelings + rating fill her check-in only if that day doesn't have one yet.
                    </p>
                  </div>

                  {p.draft.entries.map((entry, i) => (
                    <div key={i} className="border border-line rounded-xl p-2 flex flex-col gap-1">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={entry.title}
                          onChange={(e) =>
                            patchDraft(p.id, {
                              entries: p.draft!.entries.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                            })
                          }
                          aria-label={`Entry ${i + 1} prompt`}
                          placeholder="Prompt (e.g. Three good things today…)"
                          className="flex-1 min-h-10 px-2 rounded-xl border-2 border-line font-bold"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-coral"
                          onClick={() => patchDraft(p.id, { entries: p.draft!.entries.filter((_, j) => j !== i) })}
                        >
                          ✕
                        </Button>
                      </div>
                      <textarea
                        value={entry.text}
                        onChange={(e) =>
                          patchDraft(p.id, {
                            entries: p.draft!.entries.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                          })
                        }
                        rows={3}
                        aria-label={`Entry ${i + 1} — her words`}
                        className="w-full rounded-xl border-2 border-line p-2"
                      />
                      <p className="text-muted text-xs">
                        {countWords(entry.text)} words · {countSentences(entry.text)} sentences — her words, exactly as written
                      </p>
                    </div>
                  ))}
                  <div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => patchDraft(p.id, { entries: [...p.draft!.entries, { title: '', text: '' }] })}
                    >
                      + Add another entry
                    </Button>
                  </div>

                  <label className="flex items-center gap-2 font-bold">
                    <input
                      type="checkbox"
                      checked={p.draft.keepPhoto}
                      onChange={(e) => patchDraft(p.id, { keepPhoto: e.target.checked })}
                      className="size-4 accent-teal"
                    />
                    Keep the page photo on her journal page
                  </label>
                  {p.draft.keepPhoto && (
                    <input
                      type="text"
                      value={p.draft.photoCaption}
                      onChange={(e) => patchDraft(p.id, { photoCaption: e.target.value })}
                      aria-label="Photo caption"
                      placeholder="Caption under the photo"
                      className="min-h-10 px-2 rounded-xl border-2 border-line"
                    />
                  )}

                  <div>
                    <Button size="sm" disabled={!p.draft.date} onClick={() => void writePage(p)}>
                      ✅ Add to her journal
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
