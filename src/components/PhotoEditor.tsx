import { useRef, useState } from 'react'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { sectionsRef, clientId, type JournalSection } from '@/lib/journal'
import { fileToDataUrl, downscaleImage } from '@/lib/images'
import { countWords, countSentences } from '@/lib/counting'
import { celebrate } from '@/lib/confetti'

const CAPTION_STARTERS = ['I made this…', 'The best part is…', 'It took me…']
const MAX_PHOTOS = 3

interface Panel {
  image: string
  caption: string
}

/**
 * Photo mode: snap her art, crafts, and creations with the iPad camera (or
 * pick from the photo library). Photos persist exactly like drawings —
 * downscaled JPEG data URLs in `panels` — so the journal page, exports, and
 * totals all treat them the same, and captions count toward daily stats.
 */
export function PhotoEditor({
  dateKey,
  section,
  onClose,
}: {
  dateKey: string
  section: JournalSection & { panels?: Panel[] }
  onClose: () => void
}) {
  const [photos, setPhotos] = useState<Panel[]>(section.panels ?? [])
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setAdding(true)
    try {
      const room = MAX_PHOTOS - photos.length
      const next: Panel[] = []
      for (const file of [...files].slice(0, room)) {
        const raw = await fileToDataUrl(file)
        next.push({ image: await downscaleImage(raw), caption: '' })
      }
      setPhotos((p) => [...p, ...next])
    } catch (e) {
      console.warn('photo add failed:', (e as Error).message)
    } finally {
      setAdding(false)
      if (cameraRef.current) cameraRef.current.value = ''
      if (libraryRef.current) libraryRef.current.value = ''
    }
  }

  async function save() {
    setSaving(true)
    try {
      const captionText = photos.map((p) => p.caption.trim()).filter(Boolean).join(' ')
      await updateDoc(doc(sectionsRef(dateKey), section.id), {
        panels: photos,
        plainText: captionText,
        text: captionText,
        wordCount: countWords(captionText),
        sentenceCount: countSentences(captionText),
        status: 'saved',
        clientId,
        updatedAt: serverTimestamp(),
      })
      celebrate()
      onClose()
    } catch (e) {
      console.warn('photo save failed:', (e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onClose}>
          ← Back
        </Button>
        <p className="font-extrabold">📸 Photo</p>
        <Button size="sm" onClick={save} disabled={saving || adding || photos.length === 0}>
          {saving ? 'Saving…' : 'Save 💾'}
        </Button>
      </div>

      {/* hidden inputs — `capture` opens the camera straight away on iPad */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void addFiles(e.target.files)}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void addFiles(e.target.files)}
      />

      {photos.length < MAX_PHOTOS && (
        <div className="flex gap-2 justify-center">
          <Button variant="secondary" disabled={adding} onClick={() => cameraRef.current?.click()}>
            {adding ? 'Adding…' : '📷 Take a photo'}
          </Button>
          <Button variant="secondary" disabled={adding} onClick={() => libraryRef.current?.click()}>
            🖼️ From my photos
          </Button>
        </div>
      )}

      {photos.length === 0 && !adding && (
        <p className="text-center text-muted text-sm">
          Show off your art, crafts, and creations — up to {MAX_PHOTOS} photos on today's page!
        </p>
      )}

      {photos.map((p, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="polaroid relative mx-auto" style={{ width: 260 }}>
            <span className="tape" />
            <img src={p.image} alt={p.caption || `Photo ${i + 1}`} className="w-full" />
            {p.caption.trim() && (
              <p className="font-hand text-lg text-center mt-1 text-ink/80">{p.caption}</p>
            )}
          </div>
          <input
            type="text"
            value={p.caption}
            onChange={(e) =>
              setPhotos((ps) => ps.map((v, j) => (j === i ? { ...v, caption: e.target.value } : v)))
            }
            placeholder="Tell me about this…"
            aria-label={`Caption for photo ${i + 1}`}
            className="w-full min-h-12 px-4 rounded-2xl border-2 border-line bg-paper
                       focus:border-teal focus:outline-none text-base"
          />
          <div className="flex flex-wrap gap-2 items-center">
            {CAPTION_STARTERS.map((s) => (
              <Chip
                key={s}
                onClick={() =>
                  setPhotos((ps) =>
                    ps.map((v, j) =>
                      j === i ? { ...v, caption: (v.caption ? v.caption + ' ' : '') + s } : v,
                    ),
                  )
                }
              >
                {s}
              </Chip>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="text-coral ml-auto"
              onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
