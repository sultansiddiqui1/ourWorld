import { lazy, Suspense, useState, type ReactNode } from 'react'
import { features } from '../../content/config'
import Universe from '../universe/Universe'

// Each extra tab (and its 3D model) only downloads when it's opened — so tabs that are
// switched off in `features` never cost the live site anything.
const Letters = lazy(() => import('../letters/Letters'))
const Vending = lazy(() => import('../vending/Vending'))
const Punch = lazy(() => import('../punch/Punch'))
const Love = lazy(() => import('../love/Love'))
const Countdown = lazy(() => import('../countdown/Countdown'))

type Tab = 'universe' | 'letters' | 'vending' | 'punch' | 'love' | 'countdown'

const ALL_TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'universe',
    label: 'Universe',
    icon: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />,
  },
  {
    id: 'letters',
    label: 'Open when',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
      </>
    ),
  },
  {
    id: 'vending',
    label: 'Reasons',
    icon: (
      <>
        <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
        <path d="M8 6h8M8 10h8M9 17h6" />
        <circle cx="12" cy="13.5" r="0.6" />
      </>
    ),
  },
  {
    id: 'punch',
    label: 'Punch me',
    icon: (
      <>
        <path d="M7 10V8a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4v5a5 5 0 0 1-5 5h-2a4 4 0 0 1-4-4v-1" />
        <path d="M7 10a2 2 0 1 0 0 4h2M12 4v4M9 20h6" />
      </>
    ),
  },
  {
    id: 'countdown',
    label: 'Until you',
    icon: <path d="M2.5 13.5l7-2.2L14 4.5l2 .6-2 7 5-1.6 1.6-2.2 1.4.4-1 3.6c-.2.7-.8 1.2-1.5 1.4L4 17.5l-1.5-4z" />,
  },
  {
    id: 'love',
    label: 'Love me',
    icon: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  },
]

const ENABLED: Record<Tab, boolean> = { universe: true, letters: features.letters, vending: features.reasons, punch: features.punch, love: features.love, countdown: features.countdown }
const TABS = ALL_TABS.filter((t) => ENABLED[t.id])

export default function AppShell() {
  const [tab, setTab] = useState<Tab>('universe')
  return (
    <div className="flex h-full flex-col">
      <main className="relative min-h-0 flex-1">
        {/* Universe stays mounted so its 3D scenes don't reload; its render loop pauses when hidden. */}
        <div className={tab === 'universe' ? 'h-full' : 'hidden'}>
          <Universe active={tab === 'universe'} />
        </div>
        <Suspense fallback={<div className="grid h-full place-items-center text-sm text-white/40">loading…</div>}>
          {tab === 'letters' && <Letters active />}
          {tab === 'vending' && <Vending active />}
          {tab === 'punch' && <Punch active />}
          {tab === 'love' && <Love active />}
          {tab === 'countdown' && <Countdown active />}
        </Suspense>
      </main>
      <nav className="relative z-40 border-t border-white/[0.07] bg-night-900/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <ul className="flex">
          {TABS.map((t) => {
            const on = t.id === tab
            return (
              <li key={t.id} className="flex-1">
                <button
                  onClick={() => setTab(t.id)}
                  aria-current={on ? 'page' : undefined}
                  className={`flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${on ? 'text-blush' : 'text-white/45'}`}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    {t.icon}
                  </svg>
                  {t.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
