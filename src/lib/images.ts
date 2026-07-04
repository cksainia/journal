/** Camera/photo helpers. Photos persist as downscaled JPEG data URLs on the
 *  section doc (house pattern — same as drawings; no Cloud Storage). Firestore
 *  caps docs at 1MB, so every image is re-encoded down until it fits its
 *  budget. Browsers apply EXIF orientation during decode, so no manual
 *  rotation handling is needed. */

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('could not read the photo'))
    r.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('could not open the photo'))
    img.src = src
  })
}

/**
 * Downscale + re-encode an image to a JPEG data URL no larger than
 * `maxChars` (data-URL length ≈ bytes × 4/3). Steps quality down, then
 * dimensions, until it fits — it never throws for being too big.
 */
export async function downscaleImage(
  src: string,
  { maxDim = 1000, maxChars = 320_000 }: { maxDim?: number; maxChars?: number } = {},
): Promise<string> {
  const img = await loadImage(src)
  let dim = maxDim
  for (;;) {
    const scale = Math.min(1, dim / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff' // JPEG has no alpha — flatten on white
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.72, 0.6, 0.5, 0.4]) {
      const out = canvas.toDataURL('image/jpeg', quality)
      if (out.length <= maxChars) return out
    }
    if (dim <= 400) return canvas.toDataURL('image/jpeg', 0.4) // floor — accept what we have
    dim = Math.round(dim * 0.7)
  }
}
