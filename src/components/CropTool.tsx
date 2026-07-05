import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { downscaleImage } from '@/lib/images'

const ASPECTS = [
  { id: 'square', label: '◻︎ Square', ratio: 1 },
  { id: 'wide', label: '▭ Wide', ratio: 4 / 3 },
  { id: 'tall', label: '▯ Tall', ratio: 3 / 4 },
] as const

const FRAME_W = 280

/**
 * Simple kid-friendly crop: pick a shape, drag the photo around inside the
 * frame, zoom with the slider, done. Exports a fresh (re-downscaled) JPEG
 * data URL so cropped photos still respect the Firestore size budget.
 */
export function CropTool({
  src,
  onDone,
  onCancel,
}: {
  src: string
  onDone: (cropped: string) => void
  onCancel: () => void
}) {
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>(ASPECTS[1])
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => setNat({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = src
  }, [src])

  const frameH = Math.round(FRAME_W / aspect.ratio)
  // cover-fit baseline, then user zoom on top
  const scale = nat ? Math.max(FRAME_W / nat.w, frameH / nat.h) * zoom : 1
  const dw = (nat?.w ?? 1) * scale
  const dh = (nat?.h ?? 1) * scale
  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v))
  const ox = clamp(off.x, (dw - FRAME_W) / 2)
  const oy = clamp(off.y, (dh - frameH) / 2)

  async function done() {
    if (!nat) return
    setBusy(true)
    try {
      const srcX = (dw / 2 - FRAME_W / 2 - ox) / scale
      const srcY = (dh / 2 - frameH / 2 - oy) / scale
      const srcW = FRAME_W / scale
      const srcH = frameH / scale
      const img = new Image()
      await new Promise<void>((res, rej) => {
        img.onload = () => res()
        img.onerror = () => rej(new Error('crop failed'))
        img.src = src
      })
      const outW = Math.min(1000, Math.round(srcW))
      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = Math.round(outW / aspect.ratio)
      canvas.getContext('2d')!.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height)
      onDone(await downscaleImage(canvas.toDataURL('image/jpeg', 0.85)))
    } catch (e) {
      console.warn('crop failed:', (e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 bg-paper border border-line rounded-3xl p-4 shadow-card">
      <div className="flex gap-2">
        {ASPECTS.map((a) => (
          <Chip key={a.id} active={aspect.id === a.id} onClick={() => { setAspect(a); setOff({ x: 0, y: 0 }) }}>
            {a.label}
          </Chip>
        ))}
      </div>

      <div
        className="relative overflow-hidden rounded-xl border-2 border-teal touch-none cursor-grab active:cursor-grabbing bg-soft"
        style={{ width: FRAME_W, height: frameH }}
        onPointerDown={(e) => {
          drag.current = { px: e.clientX, py: e.clientY, ox, oy }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          setOff({
            x: drag.current.ox + (e.clientX - drag.current.px),
            y: drag.current.oy + (e.clientY - drag.current.py),
          })
        }}
        onPointerUp={() => (drag.current = null)}
        role="application"
        aria-label="Drag the photo to choose the crop"
      >
        {nat && (
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute max-w-none select-none pointer-events-none"
            style={{
              width: dw,
              height: dh,
              left: FRAME_W / 2 - dw / 2 + ox,
              top: frameH / 2 - dh / 2 + oy,
            }}
          />
        )}
      </div>

      <label className="flex items-center gap-2 w-full max-w-xs text-sm font-bold">
        🔎
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(+e.target.value)}
          aria-label="Zoom"
          className="flex-1 accent-teal"
        />
      </label>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => void done()} disabled={busy || !nat}>
          {busy ? 'Cropping…' : 'Crop it ✂️'}
        </Button>
      </div>
    </div>
  )
}
