/**
 * Firestore security-rules tests (spec §11: rules are the security boundary,
 * proven in the emulator). Run: npm run test:rules
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore'

const PARENT_UID = 'ForoefZlHRbJIwZgCraAxAUfq1n2'
const CHILD_UID = 'O93lhqGLBye4TLzYrREpRaEBm972'
const DAY_ID = `aria_${CHILD_UID}_20260702`

let env: RulesTestEnvironment

const asParent = () => env.authenticatedContext(PARENT_UID).firestore()
const asChild = () => env.authenticatedContext(CHILD_UID).firestore()
const asStranger = () => env.authenticatedContext('stranger-uid-123').firestore()
const asNobody = () => env.unauthenticatedContext().firestore()

const dayData = {
  familyId: 'aria',
  childId: CHILD_UID,
  dateKey: '2026-07-02',
  timezone: 'America/New_York',
  dailyTotals: { words: 0, sentences: 0, sections: 0, reviewedSections: 0, drawings: 0 },
}
const sectionData = { type: 'free', text: '<p>hi</p>', plainText: 'hi', status: 'draft' }

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

describe('journalDays', () => {
  it('child can create and update her own day', async () => {
    await assertSucceeds(setDoc(doc(asChild(), 'journalDays', DAY_ID), dayData))
    await assertSucceeds(
      updateDoc(doc(asChild(), 'journalDays', DAY_ID), { 'dailyTotals.words': 5 }),
    )
  })

  it('child cannot create a day keyed to someone else', async () => {
    await assertFails(
      setDoc(doc(asChild(), 'journalDays', 'aria_other-kid-uid_20260702'), dayData),
    )
  })

  it('parent can read and delete the day; child cannot delete it', async () => {
    await setDoc(doc(asChild(), 'journalDays', DAY_ID), dayData)
    await assertSucceeds(getDoc(doc(asParent(), 'journalDays', DAY_ID)))
    await assertFails(deleteDoc(doc(asChild(), 'journalDays', DAY_ID)))
    await assertSucceeds(deleteDoc(doc(asParent(), 'journalDays', DAY_ID)))
  })

  it('stranger and unauthenticated users are locked out', async () => {
    await setDoc(doc(asChild(), 'journalDays', DAY_ID), dayData)
    await assertFails(getDoc(doc(asStranger(), 'journalDays', DAY_ID)))
    await assertFails(setDoc(doc(asStranger(), 'journalDays', DAY_ID), dayData))
    await assertFails(getDoc(doc(asNobody(), 'journalDays', DAY_ID)))
  })
})

describe('sections — the no-hard-delete rule', () => {
  const sectionPath = ['journalDays', DAY_ID, 'sections', 's1'] as const

  beforeEach(async () => {
    await setDoc(doc(asChild(), 'journalDays', DAY_ID), dayData)
    await setDoc(doc(asChild(), ...sectionPath), sectionData)
  })

  it('child can create, edit, and ARCHIVE her section', async () => {
    await assertSucceeds(updateDoc(doc(asChild(), ...sectionPath), { plainText: 'hello world' }))
    await assertSucceeds(updateDoc(doc(asChild(), ...sectionPath), { status: 'archived' }))
  })

  it('child can NEVER hard-delete a section', async () => {
    await assertFails(deleteDoc(doc(asChild(), ...sectionPath)))
  })

  it('parent can delete and restore (archive→saved)', async () => {
    await assertSucceeds(updateDoc(doc(asParent(), ...sectionPath), { status: 'saved' }))
    await assertSucceeds(deleteDoc(doc(asParent(), ...sectionPath)))
  })

  it('child can append a review but not amend or remove it', async () => {
    const reviewPath = ['journalDays', DAY_ID, 'sections', 's1', 'reviews', 'r1'] as const
    await assertSucceeds(setDoc(doc(asChild(), ...reviewPath), { schemaVersion: '1.0' }))
    await assertFails(updateDoc(doc(asChild(), ...reviewPath), { schemaVersion: '2.0' }))
    await assertFails(deleteDoc(doc(asChild(), ...reviewPath)))
    await assertSucceeds(deleteDoc(doc(asParent(), ...reviewPath)))
  })
})

describe('Summer Tracker docs (existing behavior preserved)', () => {
  it('parent (only) writes families/aria', async () => {
    await assertSucceeds(setDoc(doc(asParent(), 'families', 'aria'), { completions: {} }))
    await assertFails(setDoc(doc(asChild(), 'families', 'aria'), { completions: {} }))
  })

  it('child can write families/aria-claims (journal sync target)', async () => {
    await assertSucceeds(
      setDoc(doc(asChild(), 'families', 'aria-claims'), { journal: { '2026-07-02': 6 } }),
    )
  })

  it('stranger cannot touch tracker docs', async () => {
    await assertFails(getDoc(doc(asStranger(), 'families', 'aria')))
    await assertFails(setDoc(doc(asStranger(), 'families', 'aria-claims'), { journal: {} }))
  })
})

describe('member role docs', () => {
  it('parent manages members; child cannot', async () => {
    await assertSucceeds(
      setDoc(doc(asParent(), 'families', 'aria', 'members', 'babysitter-uid'), { role: 'parent' }),
    )
    await assertFails(
      setDoc(doc(asChild(), 'families', 'aria', 'members', CHILD_UID), { role: 'parent' }),
    )
  })

  it('a member doc grants access to a non-hardcoded uid', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'families', 'aria', 'members', 'grandma-uid'), {
        role: 'parent',
      })
    })
    const asGrandma = env.authenticatedContext('grandma-uid').firestore()
    await assertSucceeds(setDoc(doc(asGrandma, 'journalDays', DAY_ID), dayData))
    await assertSucceeds(getDoc(doc(asGrandma, 'families', 'aria')))
  })
})

describe('parent-only surfaces', () => {
  it('weeklyInsights are parent-only', async () => {
    await assertSucceeds(
      setDoc(doc(asParent(), 'weeklyInsights', 'aria_w1'), { strengths: ['voice'] }),
    )
    await assertFails(getDoc(doc(asChild(), 'weeklyInsights', 'aria_w1')))
  })
})
