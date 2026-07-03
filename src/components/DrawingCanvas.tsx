import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Chip } from '@/components/ui/chip'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Kid-friendly HTML5 canvas (spec §4.2C): brush sizes, warm palette, eraser,
 * undo. Strokes autosave to localStorage (draft resilience before the PNG is
 * persisted); export downscales to a compact PNG data URL — stored in
 * Firestore, house-pattern style (like the tracker's ~45KB cover thumbnails),
 * so no Cloud Storage setup is required.
 */

const SIZE = 800 // internal resolution (square)
const EXPORT_SIZE = 480 // downscaled persistence size

const PALETTE = ['#2E2A36', '#F4634A', '#12A594', '#FFC53D', '#8F7BE8', '#3B82F6', '#EC4899', '#8B5A2B']
const BRUSHES = [4, 10, 22]

interface Stroke {
  color: string
  size: number
  erase: boolean
  points: { x: number; y: number }[]
}

export interface DrawingCanvasHandle {
  exportPng: () => string | null // null when empty
  isEmpty: () => boolean
  clearDraft: () => void
}

export const DrawingCanvas = forwardRef<
  DrawingCanvasHandle,
  { draftKey: string; background?: string }
>(function DrawingCanvas({ draftKey, background }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bgImage = useRef<HTMLImageElement | null>(null)
  const strokes = useRef<Stroke[]>([])
  const current = useRef<Stroke | null>(null)
  const [color, setColor] = useState(PALETTE[0])
  const [size, setSize] = useState(BRUSHES[1])
  const [erasing, setErasing] = useState(false)
  const [, bump] = useState(0) // repaint trigger for undo button state

  const storageKey = `drawing-draft-${draftKey}`

  function redraw() {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, SIZE, SIZE)
    if (bgImage.current) ctx.drawImage(bgImage.current, 0, 0, SIZE, SIZE)
    for (const s of [...strokes.current, ...(current.current ? [current.current] : [])]) {
      ctx.strokeStyle = s.erase ? '#FFFFFF' : s.color
      ctx.lineWidth = s.erase ? s.size * 3 : s.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      if (s.points.length === 1) ctx.lineTo(s.points[0].x + 0.1, s.points[0].y + 0.1)
      ctx.stroke()
    }
  }

  useEffect(() => {
    // restore local draft strokes (spec: strokes saved locally before upload)
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) strokes.current = JSON.parse(saved)
    } catch { /* fresh start */ }
    if (background) {
      const img = new Image()
      img.onload = () => {
        bgImage.current = img
        redraw()
      }
      img.src = background
    }
    redraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, background])

  function persistDraft() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(strokes.current))
    } catch { /* quota — draft resilience is best-effort */ }
  }

  function pos(e: React.PointerEvent): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * SIZE,
      y: ((e.clientY - rect.top) / rect.height) * SIZE,
    }
  }

  useImperativeHandle(ref, () => ({
    exportPng() {
      if (this.isEmpty()) return null
      const out = document.createElement('canvas')
      out.width = EXPORT_SIZE
      out.height = EXPORT_SIZE
      out.getContext('2d')!.drawImage(canvasRef.current!, 0, 0, EXPORT_SIZE, EXPORT_SIZE)
      return out.toDataURL('image/png')
    },
    isEmpty: () => strokes.current.length === 0 && !bgImage.current,
    clearDraft: () => localStorage.removeItem(storageKey),
  }))

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        aria-label="Drawing canvas"
        className="w-full aspect-square bg-white rounded-3xl border border-line shadow-card touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          current.current = { color, size, erase: erasing, points: [pos(e)] }
          redraw()
        }}
        onPointerMove={(e) => {
          if (!current.current) return
          current.current.points.push(pos(e))
          redraw()
        }}
        onPointerUp={() => {
          if (current.current) {
            strokes.current.push(current.current)
            current.current = null
            persistDraft()
            bump((n) => n + 1)
          }
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        {PALETTE.map((c) => (
          <button
            key={c}
            aria-label={`Color ${c}`}
            onClick={() => {
              setColor(c)
              setErasing(false)
            }}
            className={cn(
              'size-9 rounded-full border-2 transition-transform',
              color === c && !erasing ? 'border-ink scale-110' : 'border-line',
            )}
            style={{ backgroundColor: c }}
          />
        ))}
        {BRUSHES.map((b) => (
          <Chip key={b} active={size === b} onClick={() => setSize(b)} aria-label={`Brush size ${b}`}>
            <span className="rounded-full bg-current inline-block" style={{ width: b / 2 + 4, height: b / 2 + 4 }} />
          </Chip>
        ))}
        <Chip active={erasing} onClick={() => setErasing(!erasing)}>🧽 Eraser</Chip>
        <Button
          variant="ghost"
          size="sm"
          disabled={strokes.current.length === 0}
          onClick={() => {
            strokes.current.pop()
            persistDraft()
            redraw()
            bump((n) => n + 1)
          }}
        >
          ↩️ Undo
        </Button>
      </div>
    </div>
  )
})
