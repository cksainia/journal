/**
 * Summer Tracker sync adapter tests (spec §8, §14): create / edit / archive /
 * restore / multi-section idempotency, plus merge-preservation of the claims
 * doc. Runs the REAL adapter (writeTrackerClaim / computeTotals) against the
 * Firestore emulator through the child's security context — proving both the
 * contract and that the rules permit the writes.  Run: npm run test:rules
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { computeTotals } from '../../src/lib/totals'
import { syncDayToTracker, writeTrackerClaim } from '../../src/lib/trackerSync'

const CHILD_UID = 'O93lhqGLBye4TLzYrREpRaEBm972'
const DATE = '2026-07-03'

let env: RulesTestEnvironment
const childDb = () => env.authenticatedContext(CHILD_UID).firestore()

const section = (words: number, sentences: number, status = 'saved', type = 'free') => ({
  status,
  type,
  wordCount: words,
  sentenceCount: sentences,
})

async function claimValue(dateKey = DATE): Promise<number | undefined> {
  const snap = await getDoc(doc(childDb(), 'families', 'aria-claims'))
  return snap.exists() ? snap.data()?.journal?.[dateKey] : undefined
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-aria-journal',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})
afterAll(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await env.clearFirestore()
})

describe('tracker sync adapter contract', () => {
  it('create: day totals land as the claim value', async () => {
    // @ts-expect-error rules-unit-testing Firestore is API-compatible
    const res = await syncDayToTracker(childDb(), DATE, computeTotals([section(50, 6)]))
    expect(res.status).toBe('synced')
    expect(res.targetPath).toContain('journal.' + DATE)
    expect(await claimValue()).toBe(6)
  })

  it('edit: value UPDATES, never duplicates or increments', async () => {
    // @ts-expect-error compat
    await writeTrackerClaim(childDb(), DATE, 6)
    // @ts-expect-error compat
    await writeTrackerClaim(childDb(), DATE, computeTotals([section(80, 9)]).sentences)
    expect(await claimValue()).toBe(9)
    const journalMap = (await getDoc(doc(childDb(), 'families', 'aria-claims'))).data()?.journal
    expect(Object.keys(journalMap)).toEqual([DATE]) // one key, not appended copies
  })

  it('archive: recompute excludes archived sections and syncs the lower value', async () => {
    const sections = [section(50, 6), section(30, 4)]
    // @ts-expect-error compat
    await syncDayToTracker(childDb(), DATE, computeTotals(sections))
    expect(await claimValue()).toBe(10)
    sections[1] = section(30, 4, 'archived')
    // @ts-expect-error compat
    await syncDayToTracker(childDb(), DATE, computeTotals(sections))
    expect(await claimValue()).toBe(6)
  })

  it('restore: archived section restored → value comes back', async () => {
    const sections = [section(50, 6, 'archived')]
    // @ts-expect-error compat
    await syncDayToTracker(childDb(), DATE, computeTotals(sections))
    expect(await claimValue()).toBe(0)
    sections[0] = section(50, 6, 'saved')
    // @ts-expect-error compat
    await syncDayToTracker(childDb(), DATE, computeTotals(sections))
    expect(await claimValue()).toBe(6)
  })

  it('multi-section day sums live sections only', async () => {
    const totals = computeTotals([
      section(50, 6),
      section(20, 3, 'saved', 'nudge'),
      section(15, 2, 'draft'),
      section(99, 99, 'archived'),
    ])
    expect(totals.sentences).toBe(11)
    // @ts-expect-error compat
    await syncDayToTracker(childDb(), DATE, totals)
    expect(await claimValue()).toBe(11)
  })

  it('idempotent: syncing twice yields the same stored value', async () => {
    const totals = computeTotals([section(50, 6)])
    // @ts-expect-error compat
    await syncDayToTracker(childDb(), DATE, totals)
    // @ts-expect-error compat
    await syncDayToTracker(childDb(), DATE, totals)
    expect(await claimValue()).toBe(6)
  })

  it("merge-write preserves the tracker's other claim data", async () => {
    // Simulate existing tracker state: habits, other journal days.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'families', 'aria-claims'), {
        comp: { '2026-07-01': { ixl: true } },
        hab: { '2026-07-01': { water: true } },
        journal: { '2026-07-01': 22 },
        reward: 'ice cream',
      })
    })
    // @ts-expect-error compat
    await writeTrackerClaim(childDb(), DATE, 6)
    const data = (await getDoc(doc(childDb(), 'families', 'aria-claims'))).data()!
    expect(data.journal[DATE]).toBe(6)
    expect(data.journal['2026-07-01']).toBe(22) // other day untouched
    expect(data.comp['2026-07-01'].ixl).toBe(true) // other maps untouched
    expect(data.reward).toBe('ice cream')
  })

  it('distinct timezone days produce distinct claim keys (Dubai test)', async () => {
    // @ts-expect-error compat
    await writeTrackerClaim(childDb(), '2026-07-03', 5) // 11 PM Dubai
    // @ts-expect-error compat
    await writeTrackerClaim(childDb(), '2026-07-04', 7) // next NJ morning... local keys differ
    const journalMap = (await getDoc(doc(childDb(), 'families', 'aria-claims'))).data()?.journal
    expect(journalMap['2026-07-03']).toBe(5)
    expect(journalMap['2026-07-04']).toBe(7)
  })

  it('a stranger cannot write the claims doc at all', async () => {
    const strangerDb = env.authenticatedContext('stranger').firestore()
    // @ts-expect-error compat
    await assertFails(writeTrackerClaim(strangerDb, DATE, 99))
  })
})
