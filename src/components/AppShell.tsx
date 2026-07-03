import { NavLink, Outlet } from 'react-router-dom'
import { useSession } from '@/stores/session'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/', label: 'Today', emoji: '📝' },
  { to: '/journal', label: 'My Journal', emoji: '📅' },
  { to: '/progress', label: 'My Progress', emoji: '🌟' },
  { to: '/parent', label: 'Parents', emoji: '👨‍👩‍👧', parentOnly: true },
]

/**
 * App shell: bottom tab bar on phones/portrait, a side nav on wide screens
 * (Chromebook, iPad landscape — spec §3). The Parents tab only exists for the
 * parent account; hiding it for Aria is UX tidiness — the rules are what
 * actually protect the data.
 */
export function AppShell() {
  const role = useSession((s) => s.role)
  const tabs = TABS.filter((t) => !t.parentOnly || role === 'parent')

  return (
    <div className="min-h-dvh lg:flex">
      {/* side nav — wide screens */}
      <nav
        aria-label="Main"
        className="hidden lg:flex flex-col gap-1.5 w-56 shrink-0 sticky top-0 h-dvh p-4
                   border-r border-line bg-paper/70 backdrop-blur"
      >
        <p className="font-extrabold text-xl px-3 pt-2 pb-4">
          <span aria-hidden>🦉 </span>Aria's Journal
        </p>
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-2xl px-4 min-h-12 font-extrabold transition-colors',
                'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lavender',
                isActive ? 'bg-coral-soft text-coral' : 'text-muted hover:bg-soft hover:text-ink',
              )
            }
          >
            <span className="text-2xl" aria-hidden>
              {t.emoji}
            </span>
            {t.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 w-full max-w-2xl lg:max-w-3xl mx-auto px-4 pt-4 pb-28 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {/* bottom bar — phones / portrait */}
      <nav
        aria-label="Main"
        className="lg:hidden fixed bottom-0 inset-x-0 bg-paper/95 backdrop-blur border-t border-line
                   pb-[env(safe-area-inset-bottom)]"
      >
        <div
          className="max-w-2xl mx-auto grid"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2.5 min-h-16 text-xs font-bold transition-colors',
                  isActive ? 'text-coral' : 'text-muted hover:text-ink',
                )
              }
            >
              <span className="text-2xl" aria-hidden>
                {t.emoji}
              </span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
