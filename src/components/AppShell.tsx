import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/', label: 'Today', emoji: '📝' },
  { to: '/journal', label: 'My Journal', emoji: '📅' },
  { to: '/progress', label: 'My Progress', emoji: '🌟' },
  { to: '/parent', label: 'Parents', emoji: '👨‍👩‍👧' },
]

/** Four-tab shell: bottom bar on touch, big friendly targets, iPad safe areas. */
export function AppShell() {
  return (
    <div className="min-h-dvh flex flex-col">
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-4 pb-28">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed bottom-0 inset-x-0 bg-paper/95 backdrop-blur border-t border-line
                   pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-2xl mx-auto grid grid-cols-4">
          {TABS.map((t) => (
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
