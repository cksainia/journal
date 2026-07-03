import { create } from 'zustand'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  setPersistence,
  browserLocalPersistence,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { FAMILY_ID, PARENT_UID, CHILD_UID } from '@/lib/constants'
import { startSettingsSync, stopSettingsSync } from './settings'

export type Role = 'parent' | 'child'

interface SessionState {
  status: 'loading' | 'signedOut' | 'ready'
  user: User | null
  role: Role | null
  signInError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

/** Hardcoded UID map first (house style, matches the tracker), then the
 *  rules-readable members/{uid} role doc as the extensible path. */
async function resolveRole(user: User): Promise<Role | null> {
  if (user.uid === PARENT_UID) return 'parent'
  if (user.uid === CHILD_UID) return 'child'
  try {
    const snap = await getDoc(doc(db, 'families', FAMILY_ID, 'members', user.uid))
    const role = snap.exists() ? (snap.data().role as string) : null
    if (role === 'parent' || role === 'child') return role
  } catch {
    // fall through — unknown account
  }
  return null
}

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  user: null,
  role: null,
  signInError: null,

  async signIn(email, password) {
    set({ signInError: null })
    try {
      await setPersistence(auth, browserLocalPersistence)
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      const friendly =
        code === 'auth/invalid-credential' || code === 'auth/wrong-password'
          ? "That didn't match — check the email and password."
          : 'Sign-in hiccup — try again in a moment.'
      set({ signInError: friendly })
      throw e
    }
  },

  async signOut() {
    await fbSignOut(auth)
  },
}))

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    stopSettingsSync()
    useSession.setState({ status: 'signedOut', user: null, role: null })
    return
  }
  const role = await resolveRole(user)
  if (!role) {
    useSession.setState({ signInError: "This account isn't part of Aria's journal." })
    await fbSignOut(auth)
    return
  }
  startSettingsSync()
  useSession.setState({ status: 'ready', user, role, signInError: null })
})
