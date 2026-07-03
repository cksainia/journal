import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { SignIn } from '@/screens/SignIn'
import { Today } from '@/screens/Today'
import { MyJournal } from '@/screens/MyJournal'
import { MyProgress, ParentDashboard } from '@/screens/Placeholders'
import { useSession } from '@/stores/session'

function Splash() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3">
      <span className="text-6xl animate-bounce" aria-hidden>
        🦉
      </span>
      <p className="text-muted font-bold">Waking up…</p>
    </div>
  )
}

export default function App() {
  const status = useSession((s) => s.status)

  if (status === 'loading') return <Splash />
  if (status === 'signedOut') return <SignIn />

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Today />} />
          <Route path="journal" element={<MyJournal />} />
          <Route path="progress" element={<MyProgress />} />
          <Route path="parent" element={<ParentDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
