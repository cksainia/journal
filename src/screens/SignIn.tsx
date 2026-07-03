import { useState, type FormEvent } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSession } from '@/stores/session'
import { usingEmulators } from '@/lib/firebase'

export function SignIn() {
  const { signIn, signInError } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await signIn(email, password)
    } catch {
      // friendly message already set in the store
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <Card className="w-full max-w-sm text-center">
        <div className="text-6xl mb-2" aria-hidden>
          🦉
        </div>
        <h1 className="text-2xl font-extrabold mb-1">Aria's Journal</h1>
        <p className="text-muted text-sm mb-6">Hi! Sign in to start writing ✨</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3 text-left">
          <label className="text-sm font-bold text-ink">
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full min-h-12 px-4 rounded-2xl border-2 border-line bg-paper
                         focus:border-teal focus:outline-none text-base"
            />
          </label>
          <label className="text-sm font-bold text-ink">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full min-h-12 px-4 rounded-2xl border-2 border-line bg-paper
                         focus:border-teal focus:outline-none text-base"
            />
          </label>

          {signInError && (
            <p role="alert" className="text-coral text-sm font-bold">
              {signInError}
            </p>
          )}

          <Button type="submit" size="lg" disabled={busy} className="mt-2">
            {busy ? 'Signing in…' : "Let's go! 🚀"}
          </Button>
        </form>

        {usingEmulators && (
          <p className="mt-4 text-xs text-muted">
            Emulator mode — parent@example.test / aria@example.test, password <code>test123</code>
          </p>
        )}
      </Card>
    </div>
  )
}
