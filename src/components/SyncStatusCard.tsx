import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { dateKeyFor } from '@/lib/dateKey'
import { dayRef, retryTrackerSync, type JournalDay } from '@/lib/journal'

/** Summer Tracker sync status + manual retry (spec §8), parent-facing. */
export function SyncStatusCard() {
  const dateKey = dateKeyFor()
  const [day, setDay] = useState<JournalDay | null>(null)
  const [retrying, setRetrying] = useState(false)

  useEffect(
    () => onSnapshot(dayRef(dateKey), (s) => setDay(s.exists() ? (s.data() as JournalDay) : null)),
    [dateKey],
  )

  const sync = day?.summerTrackerSync ?? null

  async function retry() {
    setRetrying(true)
    try {
      await retryTrackerSync(dateKey)
    } finally {
      setRetrying(false)
    }
  }

  return (
    <Card>
      <CardTitle className="text-base">Summer Tracker sync</CardTitle>
      {!day ? (
        <p className="text-muted text-sm mt-2">No journal entry today yet — nothing to sync.</p>
      ) : !sync ? (
        <p className="text-muted text-sm mt-2">Waiting for the first write of the day.</p>
      ) : sync.status === 'synced' ? (
        <p className="text-teal text-sm font-bold mt-2">
          ✓ Last synced {new Date(sync.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} —{' '}
          {sync.syncedSentences} sentences → {sync.targetPath}
        </p>
      ) : (
        <p className="text-coral text-sm font-bold mt-2">⚠️ Sync failed: {sync.error}</p>
      )}
      <Button variant="secondary" size="sm" className="mt-3" onClick={retry} disabled={retrying || !day}>
        {retrying ? 'Syncing…' : 'Retry sync'}
      </Button>
    </Card>
  )
}
