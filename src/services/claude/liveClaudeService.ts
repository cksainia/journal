import {
  GuidedPromptSchema,
  ImportedPageSchema,
  ReviewSchema,
  WeeklyInsightsSchema,
  sanitizeInsights,
  sanitizeReview,
  type ClaudeService,
  type GuidedPromptInput,
  type ImportedPage,
  type ReviewInput,
  type WeeklyInsightsInput,
} from './types'
import { z } from 'zod'

/**
 * Live Claude service via the family's Cloudflare Worker (house pattern — the
 * tracker's book lookups work the same way; the API key lives ONLY in the
 * Worker's secrets). Worker source: workers/claude-proxy.js.
 *
 * Every response is UNTRUSTED until it passes the same zod schemas the mock
 * uses. A parse failure throws — callers show the friendly fallback
 * ("The writing checker is napping 😴") and writing continues unaffected.
 */
/**
 * OCR one photographed paper-journal page (parent-only import flow — a
 * standalone call, not part of ClaudeService, because it inherently needs the
 * live Worker: the mock has no eyes). Takes a JPEG data URL, returns the
 * validated extraction for the parent to review before anything is written.
 */
export async function importJournalPage(workerUrl: string, imageDataUrl: string): Promise<ImportedPage> {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/s.exec(imageDataUrl)
  if (!m) throw new Error('unsupported image format')
  const res = await fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'importJournalPage',
      payload: { mediaType: m[1], imageBase64: m[2] },
    }),
  })
  if (!res.ok) throw new Error(`worker importJournalPage → HTTP ${res.status}`)
  const data = await res.json()
  if (data?.error) throw new Error(`worker importJournalPage → ${data.error}`)
  return ImportedPageSchema.parse(data)
}

export function createLiveClaudeService(workerUrl: string): ClaudeService {
  async function call<T>(action: string, payload: unknown, schema: z.ZodType<T>): Promise<T> {
    const res = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    })
    if (!res.ok) throw new Error(`worker ${action} → HTTP ${res.status}`)
    const data = await res.json()
    if (data?.error) throw new Error(`worker ${action} → ${data.error}`)
    return schema.parse(data) // strict validation on every Claude response
  }

  return {
    live: true,
    generateGuidedPrompt: (input: GuidedPromptInput) =>
      call('generateGuidedPrompt', input, GuidedPromptSchema),
    reviewEntry: (input: ReviewInput) =>
      call('reviewEntry', input, ReviewSchema).then(sanitizeReview),
    generateWeeklyInsights: (input: WeeklyInsightsInput) =>
      call('generateWeeklyInsights', input, WeeklyInsightsSchema).then(sanitizeInsights),
    followUpQuestion: async (plainText: string) =>
      call('followUpQuestion', { plainText }, z.object({ question: z.string().min(1).max(200) })).then(
        (r) => r.question,
      ),
  }
}
