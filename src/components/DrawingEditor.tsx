import { createRef, useMemo, useRef, useState } from 'react'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { DrawingCanvas, type DrawingCanvasHandle } from '@/components/DrawingCanvas'
import { sectionsRef, clientId, type JournalSection } from '@/lib/journal'
import { countWords, countSentences } from '@/lib/counting'
import { celebrate } from '@/lib/confetti'

const CAPTION_STARTERS = ['This picture shows…', 'The best part is…', 'I chose these colors because…']

interface Panel {
  image: string
  caption: string
}

/**
 * Drawing & comic editor (spec §4.2C). Comic mode = 1–3 square panels, each
 * with a caption box beneath — covert narrative sequencing (beginning → middle
 * → end). Captions COUNT toward daily stats and sync. Panels persist as
 * compact PNG data URLs on the section doc.
 */
export function DrawingEditor({
  dateKey,
  section,
  onClose,
}: {
  dateKey: string
  section: JournalSection & { panels?: Panel[] }
  onClose: () => void
}) {
  const isComic = section.type === 'comic'
  const existing = section.panels ?? []
  const [panelCount, setPanelCount] = useState(Math.max(existing.length, 1))
  const [captions, setCaptions] = useState<string[]>(
    Array.from({ length: 3 }, (_, i) => existing[i]?.caption ?? ''),
  )
  const [active, setActive] = useState(0)
  const [saving, setSaving] = useState(false)
  const canvasRefs = useRef(Array.from({ length: 3 }, () => createRef<DrawingCanvasHandle>()))

  const panels = useMemo(() => Array.from({ length: isComic ? panelCount : 1 }, (_, i) => i), [isComic, panelCount])

  async function save() {
    setSaving(true)
    try {
      const out: Panel[] = []
      panels.forEach((i) => {
        const png = canvasRefs.current[i].current?.exportPng() ?? existing[i]?.image ?? null
        if (png) out.push({ image: png, caption: captions[i].trim() })
      })
      const captionText = out.map((p) => p.caption).filter(Boolean).join(' ')
      await updateDoc(doc(sectionsRef(dateKey), section.id), {
        panels: out,
        plainText: captionText,
        text: captionText,
        wordCount: countWords(captionText),
        sentenceCount: countSentences(captionText),
        status: 'saved',
        clientId,
        updatedAt: serverTimestamp(),
      })
      panels.forEach((i) => canvasRefs.current[i].current?.clearDraft())
      celebrate()
      onClose()
    } catch (e) {
      console.warn('drawing save failed:', (e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onClose}>
          ← Back
        </Button>
        <p className="font-extrabold">{isComic ? '🗯️ Comic' : '🎨 Drawing'}</p>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save 💾'}
        </Button>
      </div>

      {isComic && (
        <div className="flex gap-2 justify-center">
          {[1, 2, 3].map((n) => (
            <Chip key={n} active={panelCount === n} onClick={() => setPanelCount(n)}>
              {n} panel{n > 1 ? 's' : ''}
            </Chip>
          ))}
        </div>
      )}

      {isComic && panels.length > 1 && (
        <div className="flex gap-2 justify-center">
          {panels.map((i) => (
            <Chip key={i} active={active === i} onClick={() => setActive(i)}>
              {['① Beginning', '② Middle', '③ End'][i] ?? `Panel ${i + 1}`}
            </Chip>
          ))}
        </div>
      )}

      {panels.map((i) => (
        <div key={i} className={i === active || !isComic ? 'flex flex-col gap-2' : 'hidden'}>
          <DrawingCanvas
            ref={canvasRefs.current[i]}
            draftKey={`${section.id}-${i}`}
            background={existing[i]?.image}
          />
          <input
            type="text"
            value={captions[i]}
            onChange={(e) => setCaptions((c) => c.map((v, j) => (j === i ? e.target.value : v)))}
            placeholder={isComic ? 'What happens here?' : 'Tell me about your picture…'}
            aria-label={`Caption for panel ${i + 1}`}
            className="w-full min-h-12 px-4 rounded-2xl border-2 border-line bg-paper
                       focus:border-teal focus:outline-none text-base"
          />
          <div className="flex flex-wrap gap-2">
            {CAPTION_STARTERS.map((s) => (
              <Chip
                key={s}
                onClick={() => setCaptions((c) => c.map((v, j) => (j === i ? (v ? v + ' ' : '') + s : v)))}
              >
                {s}
              </Chip>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
