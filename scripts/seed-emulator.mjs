/**
 * Seed the LOCAL EMULATORS with the two family accounts (using the real
 * production UIDs so the hardcoded-UID rules behave identically) plus their
 * member role docs. Run with emulators up:  npm run emulators  →  npm run seed
 *
 * Emulator-only: `Bearer owner` is the emulator's admin bypass and does not
 * exist in production. Nothing here can touch the live project.
 */
const AUTH = 'http://127.0.0.1:9099'
const FIRESTORE = 'http://127.0.0.1:8080'
const PROJECT = 'demo-aria-journal'

const USERS = [
  { localId: 'ForoefZlHRbJIwZgCraAxAUfq1n2', email: 'parent@example.test', role: 'parent', displayName: 'Parent' },
  { localId: 'O93lhqGLBye4TLzYrREpRaEBm972', email: 'aria@example.test', role: 'child', displayName: 'Aria' },
]
const PASSWORD = 'test123'

async function req(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify(body),
  })
  if (!res.ok && res.status !== 400) throw new Error(`${url} → ${res.status}: ${await res.text()}`)
  return res
}

for (const u of USERS) {
  // Create the auth user with a pinned UID (400 = already exists → fine).
  const res = await req(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
    localId: u.localId,
    email: u.email,
    password: PASSWORD,
    displayName: u.displayName,
  })
  console.log(`auth: ${u.email} ${res.ok ? 'created' : 'already exists'}`)

  // Member role doc (rules-readable role source).
  const docUrl = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/families/aria/members/${u.localId}`
  const patch = await fetch(docUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({
      fields: {
        role: { stringValue: u.role },
        displayName: { stringValue: u.displayName },
      },
    }),
  })
  if (!patch.ok) throw new Error(`member doc for ${u.email} → ${patch.status}: ${await patch.text()}`)
  console.log(`firestore: members/${u.localId} role=${u.role}`)
}

console.log(`\nSeeded. Sign in with parent@example.test or aria@example.test / ${PASSWORD}`)
