import type { ClaudeService } from './types'
import { mockClaudeService } from './mockClaudeService'

// Phases 1–3: mock only. Phase 4 swaps in the Cloud-Function-backed live
// service behind the same interface — no call-site changes.
export const claude: ClaudeService = mockClaudeService

export * from './types'
