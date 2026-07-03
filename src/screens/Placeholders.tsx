import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSession } from '@/stores/session'

export function MyProgress() {
  return (
    <Card className="text-center">
      <span className="text-5xl" aria-hidden>
        🌟
      </span>
      <CardTitle className="mt-2">My Progress</CardTitle>
      <p className="text-muted text-sm mt-1">Your fantasy map adventure begins in Phase 7 ✨</p>
    </Card>
  )
}

export function ParentDashboard() {
  const { role, signOut, user } = useSession()

  if (role !== 'parent') {
    return (
      <Card className="text-center">
        <span className="text-5xl" aria-hidden>
          💛
        </span>
        <CardTitle className="mt-2">For grown-ups</CardTitle>
        <p className="text-muted text-sm mt-1">This page is for your parents — go write something!</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => void signOut()}>
          Switch user
        </Button>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle>Parent Dashboard</CardTitle>
        <p className="text-muted text-sm mt-1">
          Signed in as {user?.email}. Analytics, insights, and settings arrive in Phase 7; Summer
          Tracker sync status lands with Phase 3.
        </p>
      </Card>
      <Card>
        <CardTitle className="text-base">Session</CardTitle>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Card>
    </div>
  )
}
