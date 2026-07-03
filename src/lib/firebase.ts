import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import {
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

// Dev runs against local emulators (`npm run emulators` + `npm run seed`).
// Set VITE_LIVE=1 to point a dev build at production instead.
export const usingEmulators = import.meta.env.DEV && import.meta.env.VITE_LIVE !== '1'

// Same Firebase project as the Summer Tracker. This config is public by design.
// In emulator mode the projectId is swapped for the demo- one: it matches the
// seed script / emulator namespace AND makes it impossible for a dev session
// to reach production (demo-* projects have no cloud counterpart).
const firebaseConfig = {
  apiKey: 'AIzaSyDoCkJn-kRXftq6ahPocbwWJiM8GhTjQdU',
  authDomain: 'aria-tracker-c89d3.firebaseapp.com',
  projectId: usingEmulators ? 'demo-aria-journal' : 'aria-tracker-c89d3',
  storageBucket: 'aria-tracker-c89d3.firebasestorage.app',
  messagingSenderId: '943653530208',
  appId: '1:943653530208:web:014a7a7abf4b4ab2627105',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// LONG-POLLING, FORCED. The SDK's default streaming write channel hangs on the
// family's network (writes never ack) while long-polling round-trips in <500ms —
// verified live in the Summer Tracker on 2026-07-02. Do not remove without
// re-testing writes on their network.
// persistentLocalCache = offline persistence (modern replacement for the
// deprecated enableIndexedDbPersistence, per spec §2).
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalForceLongPolling: true,
})

if (usingEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
