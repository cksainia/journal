import type { ClaudeService } from './types'
import { mockClaudeService } from './mockClaudeService'
import { createLiveClaudeService } from './liveClaudeService'
import { useSettings } from '@/stores/settings'

/**
 * Service resolution: settings.aiMode ('mock' | 'live') + Worker URL decide
 * the implementation; both sit behind the same schema-validated interface.
 * isAiAvailable() additionally gates on connectivity — AI buttons disable
 * offline (spec §2), and the mock keeps everything testable end-to-end.
 */
export function getClaudeService(): ClaudeService {
  const { aiMode, workerUrl } = useSettings.getState().settings
  if (aiMode === 'live' && workerUrl) return createLiveClaudeService(workerUrl)
  return mockClaudeService
}

export function isAiAvailable(): boolean {
  const { aiMode, workerUrl } = useSettings.getState().settings
  if (aiMode === 'live' && workerUrl) return navigator.onLine
  return true // mock works offline — the point is an always-usable journal
}

export * from './types'
